"""'Manage My Pay Cycle': giving every dollar of a paycheck a job.

A paycheck group is every cycle sharing one pay_date -- normally a single
payday-layout cycle, or a legacy cycle plus the bridge cycle after it. The
plan itself (Future You, guilt-free spending, managed_at) lives on the group's
*plan period*: the cycle that starts on or after the payday. Bills' planned and
deferred amounts live on that period's BillEntry rows.

Planning never touches what has actually been paid -- that stays the existing
paid checkbox on the cycle page.
"""

import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models import BillEntry, PayPeriod, SavingsBucket, User
from app.services.events import log_event
from app.services.period_service import (
    _bill_due_date_in_range,
    cycle_income_entries,
    find_current_period,
    is_auto_mode,
    next_payday_after,
)

# Bills never suggested for moving to a later paycheck; moving one by hand
# shows a warning instead.
_ESSENTIAL_WORDS = ("housing", "rent", "mortgage", "loan", "credit", "debt", "car payment", "child")

CENT = 0.005


def _pay(p: PayPeriod) -> datetime.date:
    return p.pay_date or p.end_date


def _group(db: Session, period: PayPeriod) -> list[PayPeriod]:
    return (
        db.query(PayPeriod)
        .filter(PayPeriod.user_id == period.user_id, PayPeriod.pay_date == _pay(period))
        .order_by(PayPeriod.start_date)
        .all()
    )


def plan_period_for(db: Session, period: PayPeriod) -> Optional[PayPeriod]:
    """The cycle in this paycheck's group that carries the plan, or None if the
    group is legacy-only (its bills were due before the payday, so there's
    nothing for this paycheck to plan)."""
    candidates = [p for p in _group(db, period) if p.start_date >= _pay(p)]
    return candidates[-1] if candidates else None


def _next_pay_date(db: Session, user: User, period: PayPeriod) -> datetime.date:
    later = (
        db.query(PayPeriod.pay_date)
        .filter(PayPeriod.user_id == user.id, PayPeriod.pay_date > _pay(period))
        .order_by(PayPeriod.pay_date)
        .first()
    )
    if later is not None:
        return later[0]
    if is_auto_mode(user):
        return next_payday_after(user, _pay(period))
    return period.end_date + datetime.timedelta(days=1)


def _previous_plan_period(db: Session, period: PayPeriod) -> Optional[PayPeriod]:
    prev_pay = (
        db.query(PayPeriod.pay_date)
        .filter(PayPeriod.user_id == period.user_id, PayPeriod.pay_date < _pay(period))
        .order_by(PayPeriod.pay_date.desc())
        .first()
    )
    if prev_pay is None:
        return None
    prev = db.query(PayPeriod).filter_by(user_id=period.user_id, pay_date=prev_pay[0]).first()
    return plan_period_for(db, prev) if prev else None


def is_essential(entry: BillEntry) -> bool:
    if entry.source.is_revolving:
        return True
    text = f"{entry.source.category} {entry.source.name}".lower()
    return any(w in text for w in _ESSENTIAL_WORDS)


def _income(db: Session, period: PayPeriod) -> dict:
    """This paycheck's amount and how it's labeled (see the build plan's
    first-login table): the actual once received, otherwise the average of
    the last 3-6 received paychecks, otherwise the expected amount."""
    entries = cycle_income_entries(db, period)
    received = [e for e in entries if e.is_received or float(e.actual_amount) > 0]
    expected_total = sum(float(e.expected_amount) for e in entries)

    # Previous paychecks with recurring income actually received, newest first.
    history: list[float] = []
    earlier = (
        db.query(PayPeriod)
        .filter(PayPeriod.user_id == period.user_id, PayPeriod.pay_date < _pay(period))
        .order_by(PayPeriod.pay_date.desc())
        .all()
    )
    by_pay: dict[datetime.date, float] = {}
    for p in earlier:
        amount = sum(float(e.actual_amount) for e in p.income_entries if e.income_source_id is not None)
        by_pay[_pay(p)] = by_pay.get(_pay(p), 0.0) + amount
    for pay in sorted(by_pay, reverse=True):
        if by_pay[pay] > 0:
            history.append(by_pay[pay])
        if len(history) == 6:
            break
    average = sum(history) / len(history) if len(history) >= 3 else None

    if received:
        amount = sum(
            float(e.actual_amount) if (e.is_received or float(e.actual_amount) > 0) else float(e.expected_amount)
            for e in entries
        )
        label = "This cycle"
    elif average is not None:
        amount, label = average, "Your average"
    else:
        amount, label = expected_total, "Your estimate"

    more_than_usual = None
    if received and average is not None and amount - average >= 1:
        more_than_usual = round(amount - average, 2)

    editable = next((e for e in entries if e.income_source_id is not None), entries[0] if entries else None)
    return {
        "amount": round(amount, 2),
        "label": label,
        "is_received": bool(received),
        "more_than_usual": more_than_usual,
        "average": round(average, 2) if average is not None else None,
        "income_entry_id": editable.id if editable else None,
        "income_entry_expected": float(editable.expected_amount) if editable else None,
    }


def _bill_rows(db: Session, plan_period: PayPeriod, cycle_end: datetime.date) -> list[dict]:
    pay = _pay(plan_period)
    group = _group(db, plan_period)

    # Amounts pushed here from the previous paycheck, by bill source.
    carried: dict[int, tuple[float, datetime.date]] = {}
    prev = _previous_plan_period(db, plan_period)
    if prev is not None:
        for e in prev.bill_entries:
            if float(e.deferred_amount or 0) > CENT:
                carried[e.bill_source_id] = (float(e.deferred_amount), _pay(prev))

    rows = []
    seen_sources = set()
    for p in group:
        for e in p.bill_entries:
            due = _bill_due_date_in_range(p.start_date, p.end_date, e.source.due_day, _pay(p))
            if e.source.due_day is None:
                due_here = p.id == plan_period.id
                due = None
            else:
                due_here = due is not None and pay <= due <= cycle_end
            carried_in, carried_from = carried.get(e.bill_source_id, (0.0, None))
            if p.id != plan_period.id:
                # A legacy sibling only contributes a bill due exactly on payday;
                # carried amounts always land on the plan period's own entry.
                carried_in = 0.0
            if not due_here and carried_in <= CENT:
                continue
            if p.id == plan_period.id:
                seen_sources.add(e.bill_source_id)
            # Card payments are optional -- the user picks an amount -- so a
            # revolving card's due date doesn't plan its whole balance.
            amount_due = 0.0 if e.source.is_revolving or not due_here else float(e.target_amount)
            default = amount_due + carried_in
            planned = float(e.planned_amount) if e.planned_amount is not None else default
            rows.append(
                {
                    "entry_id": e.id,
                    "period_id": p.id,
                    "name": e.source.name,
                    "category": e.source.category,
                    "is_revolving": e.source.is_revolving,
                    "due_date": due if due_here else None,
                    "has_due_day": e.source.due_day is not None,
                    "amount_due": round(amount_due, 2),
                    "carried_in": round(carried_in, 2),
                    "carried_from": carried_from,
                    "planned": round(planned, 2),
                    "deferred": round(float(e.deferred_amount or 0), 2),
                    "is_custom": e.planned_amount is not None,
                    "is_paid": e.is_paid,
                    "actual": float(e.actual_amount),
                    "essential": is_essential(e),
                }
            )
    rows.sort(key=lambda r: (r["due_date"] is None, r["due_date"] or datetime.date.max, r["name"]))
    return rows


def _suggestions(rows: list[dict], gap: float, fun: float, future: float, next_pay: datetime.date) -> dict:
    """Next-cycle planner: concrete ways to close a gap, never a verdict."""
    with_money = [r for r in rows if r["planned"] > CENT and r["due_date"] is not None]
    # The bill furthest out is the one still waiting for dollars -- named in the
    # message only when the gap actually fits inside it, so "$1,720 still to
    # plan for Phone" can't suggest a $140 bill needs $1,720.
    last_due = max(with_money, key=lambda r: r["due_date"]) if with_money else None
    focus = last_due if last_due is not None and gap <= last_due["planned"] + CENT else None
    options = []

    movable = [r for r in rows if r["planned"] > CENT and not r["essential"]]
    if movable:
        enough = [r for r in movable if r["planned"] >= gap - CENT]
        pick = min(enough, key=lambda r: r["planned"]) if enough else max(movable, key=lambda r: r["planned"])
        options.append(
            {
                "kind": "move_bill",
                "entry_id": pick["entry_id"],
                "amount": pick["planned"],
                "text": f"Move {pick['name']} ({_money(pick['planned'])}) to your {next_pay.strftime('%-m/%-d')} paycheck",
            }
        )
    if fun > CENT:
        trim = round(min(fun, gap), 2)
        options.append(
            {"kind": "trim_fun", "amount": trim, "text": f"Trim guilt-free spending by {_money(trim)}"}
        )
    if future > CENT:
        trim = round(min(future, gap), 2)
        options.append(
            {"kind": "trim_future", "amount": trim, "text": f"Set aside {_money(trim)} less for Future You this time"}
        )
    if last_due is not None:
        script = (
            f"Hi, I'm calling about my {last_due['name']} account. My paycheck schedule changed, and a due date "
            f"after {next_pay.strftime('%B %-d')} would help me pay on time every month. Could you move my due "
            "date to a few days after my payday? Thank you!"
        )
        options.append({"kind": "due_date_script", "entry_id": last_due["entry_id"], "text": "Ask the biller for a later due date", "script": script})

    message = (
        f"{_money(gap)} still to plan for {focus['name']} on the {focus['due_date'].strftime('%-d')}{_ordinal(focus['due_date'].day)}. "
        f"Let's schedule it from your next payday."
        if focus is not None
        else f"{_money(gap)} still to plan. Let's schedule it from your next payday."
    )
    return {"gap": round(gap, 2), "message": message, "options": options}


def _money(n: float) -> str:
    return f"${n:,.0f}" if abs(n - round(n)) < CENT else f"${n:,.2f}"


def _ordinal(n: int) -> str:
    if n % 10 == 1 and n != 11:
        return "st"
    if n % 10 == 2 and n != 12:
        return "nd"
    if n % 10 == 3 and n != 13:
        return "rd"
    return "th"


def build_plan(db: Session, user: User, period: PayPeriod) -> dict:
    plan_period = plan_period_for(db, period)
    if plan_period is None:
        return {"plannable": False, "period_id": period.id, "label": period.label}

    pay = _pay(plan_period)
    next_pay = _next_pay_date(db, user, plan_period)
    cycle_end = next_pay - datetime.timedelta(days=1)
    income = _income(db, plan_period)
    rows = _bill_rows(db, plan_period, cycle_end)

    bills_total = round(sum(r["planned"] for r in rows), 2)
    # Future You defaults to the "set aside each paycheck" amounts from Setup,
    # the same way bills default to their amounts, until the user changes it.
    if plan_period.plan_future_amount is not None:
        future = float(plan_period.plan_future_amount)
    else:
        future = sum(
            float(b.per_paycheck_amount or 0)
            for b in db.query(SavingsBucket).filter_by(user_id=user.id).all()
        )
    fun = float(plan_period.plan_fun_amount or 0)
    assigned = round(bills_total + future + fun, 2)
    unassigned = round(income["amount"] - assigned, 2)  # >0: dollars without a job; <0: bills without dollars

    bucket = None
    if plan_period.plan_future_bucket_id:
        b = db.query(SavingsBucket).filter_by(id=plan_period.plan_future_bucket_id, user_id=user.id).one_or_none()
        bucket = {"id": b.id, "name": b.name} if b else None

    today = datetime.date.today()
    return {
        "plannable": True,
        "period_id": plan_period.id,
        "label": plan_period.label,
        "pay_date": pay,
        "next_pay_date": next_pay,
        "is_current": pay <= today,
        "income": income,
        "bills": rows,
        "bills_total": bills_total,
        "future_amount": round(future, 2),
        "future_set": plan_period.plan_future_amount is not None or future > 0,
        "future_bucket": bucket,
        "fun_amount": round(fun, 2),
        "fun_set": plan_period.plan_fun_amount is not None,
        "assigned": assigned,
        "still_to_plan": max(unassigned, 0.0),
        "over_planned": max(-unassigned, 0.0),
        "managed_at": plan_period.managed_at,
        "can_confirm": abs(unassigned) < 0.01 and income["amount"] > 0,
        "planner": _suggestions(rows, -unassigned, fun, future, next_pay) if unassigned < -0.009 else None,
        "days_after_payday": (today - pay).days,
    }


def current_plan_period(db: Session, user: User) -> Optional[PayPeriod]:
    periods = db.query(PayPeriod).filter_by(user_id=user.id).all()
    return find_current_period(periods, datetime.date.today())


def _clear_managed(period: PayPeriod) -> None:
    period.managed_at = None


def update_plan(
    db: Session,
    period: PayPeriod,
    future_amount=..., future_bucket_id=..., fun_amount=...,
) -> None:
    if future_amount is not ...:
        period.plan_future_amount = None if future_amount is None else max(float(future_amount), 0.0)
    if future_bucket_id is not ...:
        period.plan_future_bucket_id = future_bucket_id
    if fun_amount is not ...:
        period.plan_fun_amount = None if fun_amount is None else max(float(fun_amount), 0.0)
    _clear_managed(period)
    db.commit()


def update_bill_plan(db: Session, period: PayPeriod, entry: BillEntry, planned: Optional[float], deferred: float) -> None:
    entry.planned_amount = None if planned is None else max(float(planned), 0.0)
    entry.deferred_amount = max(float(deferred), 0.0)
    _clear_managed(period)
    db.commit()


def confirm_plan(db: Session, user: User, period: PayPeriod) -> dict:
    plan = build_plan(db, user, period)
    if not plan.get("can_confirm"):
        return plan
    first_time = period.managed_at is None
    period.managed_at = datetime.datetime.utcnow()
    if first_time:
        days = plan["days_after_payday"]
        log_event(db, user.id, "cycle_managed", days_after_payday=days, on_time=days <= 4)  # planning ahead of payday counts as on time
    db.commit()
    return build_plan(db, user, period)


def put_rest_in_fun(db: Session, user: User, period: PayPeriod) -> None:
    plan = build_plan(db, user, period)
    if plan.get("plannable") and plan["still_to_plan"] > 0:
        update_plan(db, period, fun_amount=plan["fun_amount"] + plan["still_to_plan"])

