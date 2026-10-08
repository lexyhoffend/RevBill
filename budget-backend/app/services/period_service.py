import calendar
import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    BillEntry,
    BillSource,
    IncomeEntry,
    IncomeSource,
    PayPeriod,
    SavingsBucket,
    SavingsEntry,
    SharedAccess,
    SharedAccessBill,
    User,
)


def _clamp_day(year: int, month: int, day: int) -> int:
    last_day = calendar.monthrange(year, month)[1]
    return min(day, last_day)


def _add_months(year: int, month: int, delta: int) -> tuple[int, int]:
    m = month - 1 + delta
    return year + m // 12, m % 12 + 1


def _bill_due_date_in_range(
    start: datetime.date, end: datetime.date, due_day: Optional[int], fallback: Optional[datetime.date] = None
) -> Optional[datetime.date]:
    """The calendar date `due_day` falls on within [start, end] -- e.g. rent due
    the 1st of the month, within a cycle spanning two months. Falls back to
    `end` (the cycle's own pay date) when due_day isn't set at all. But if
    due_day IS set and genuinely doesn't land inside this range, returns None --
    that means a different cycle covers this bill's real due date (e.g. a
    monthly bill on a biweekly schedule only has a real due date in roughly
    every other cycle), so this cycle's copy shouldn't be shown as due, let
    alone overdue."""
    if due_day is None:
        return fallback or end
    year, month = start.year, start.month
    while True:
        candidate = datetime.date(year, month, _clamp_day(year, month, due_day))
        if start <= candidate <= end:
            return candidate
        if candidate > end:
            return None
        year, month = _add_months(year, month, 1)


def _bill_occurrence_satisfied(
    db: Session, user_id: int, entry: BillEntry, due_date: datetime.date, periods: Optional[list] = None
) -> bool:
    """Whether this bill's due-date occurrence has actually been handled --
    checked with your own "paid" checkbox first (a revolving card payment
    that's less than the full balance is still "paid" for the cycle if you
    marked it so) on ANY cycle overlapping this occurrence's billing window --
    not just this specific entry's own cycle, since paying ahead of the due
    date in an earlier cycle and checking it paid there should count here too,
    even if that earlier cycle's own target_amount snapshot has since gone
    stale. Only falls back to summing actual amounts against this occurrence's
    target if nothing in the window was explicitly marked paid."""
    if entry.source.due_day is None:
        return entry.is_paid or float(entry.actual_amount) >= float(entry.target_amount)

    prev_year, prev_month = _add_months(due_date.year, due_date.month, -1)
    prev_due = datetime.date(prev_year, prev_month, _clamp_day(prev_year, prev_month, entry.source.due_day))
    window_start = prev_due + datetime.timedelta(days=1)

    if periods is not None:  # preloaded by the caller -- no query per bill
        overlapping_periods = [p for p in periods if p.start_date <= due_date and p.end_date >= window_start]
    else:
        overlapping_periods = (
            db.query(PayPeriod)
            .filter(PayPeriod.user_id == user_id, PayPeriod.start_date <= due_date, PayPeriod.end_date >= window_start)
            .all()
        )
    overlapping_entries = [
        e for p in overlapping_periods for e in p.bill_entries if e.bill_source_id == entry.bill_source_id
    ]
    if any(e.is_paid for e in overlapping_entries):
        return True
    total_paid = sum(float(e.actual_amount) for e in overlapping_entries)
    return total_paid >= float(entry.target_amount)


AUTO_MODES = ("weekly", "biweekly", "semimonthly", "monthly")
PAYDAY_LAYOUT = "payday"


def is_auto_mode(user: User) -> bool:
    return user.pay_cycle_mode in AUTO_MODES


def _month_paydays(user: User, year: int, month: int) -> list[datetime.date]:
    days = [user.pay_cycle_anchor_day or 1]
    if user.pay_cycle_mode == "semimonthly":
        days.append(user.pay_cycle_anchor_day2 or 31)
    return sorted({datetime.date(year, month, _clamp_day(year, month, d)) for d in days})


def next_payday_after(user: User, d: datetime.date) -> datetime.date:
    """The first payday strictly after `d` on the user's schedule."""
    if user.pay_cycle_mode in ("weekly", "biweekly"):
        step = 7 if user.pay_cycle_mode == "weekly" else 14
        anchor = user.pay_cycle_anchor_date
        k = (d - anchor).days // step + 1  # floor division, correct for negatives too
        return anchor + datetime.timedelta(days=k * step)
    year, month = d.year, d.month
    for _ in range(3):
        for payday in _month_paydays(user, year, month):
            if payday > d:
                return payday
        year, month = _add_months(year, month, 1)
    raise RuntimeError("No payday found")  # unreachable for valid schedules


def payday_on_or_before(user: User, d: datetime.date) -> datetime.date:
    """The most recent payday on or before `d`."""
    if user.pay_cycle_mode in ("weekly", "biweekly"):
        step = 7 if user.pay_cycle_mode == "weekly" else 14
        anchor = user.pay_cycle_anchor_date
        return anchor + datetime.timedelta(days=((d - anchor).days // step) * step)
    year, month = d.year, d.month
    for _ in range(3):
        for payday in reversed(_month_paydays(user, year, month)):
            if payday <= d:
                return payday
        year, month = _add_months(year, month, -1)
    raise RuntimeError("No payday found")


def _next_cycle_bounds(
    user: User, latest: Optional[PayPeriod], first_payday: Optional[datetime.date] = None
) -> tuple[datetime.date, datetime.date, datetime.date]:
    """(start, end, pay_date) of the next payday-layout cycle. A cycle runs
    from a payday to the day before the next one. If the day after `latest`
    isn't a payday -- the switch from the legacy layout, or a schedule change
    -- the gap up to the next payday becomes a "bridge" cycle that shares
    `latest`'s pay_date, since that paycheck is what funds it."""
    if latest is None:
        start = first_payday or payday_on_or_before(user, datetime.date.today())
    else:
        start = latest.end_date + datetime.timedelta(days=1)
    upcoming = next_payday_after(user, start - datetime.timedelta(days=1))  # first payday >= start
    if upcoming == start or latest is None:
        start = upcoming if latest is None else start
        return start, next_payday_after(user, start) - datetime.timedelta(days=1), start
    return start, upcoming - datetime.timedelta(days=1), latest.pay_date or latest.end_date


def _cycle_label(start: datetime.date, end: datetime.date, pay_date: datetime.date) -> str:
    label = f"Payment Cycle {pay_date.strftime('%-m/%-d/%Y')}"
    if start != pay_date:
        label += f" (bills {start.strftime('%-m/%-d')}-{end.strftime('%-m/%-d')})"
    return label


def find_overlapping_period(
    db: Session, user_id: int, start_date: datetime.date, end_date: datetime.date
) -> Optional[PayPeriod]:
    return (
        db.query(PayPeriod)
        .filter(
            PayPeriod.user_id == user_id,
            PayPeriod.start_date <= end_date,
            PayPeriod.end_date >= start_date,
        )
        .first()
    )


def compute_income_occurrences(source: IncomeSource, period_start: datetime.date, period_end: datetime.date) -> int:
    """How many times this Payment Cycle's cadence occurs within [period_start, period_end],
    counting only occurrences on/after the source's own start_date. Usually 0 or 1 for a
    ~2-week period, but the loop handles longer ranges correctly too."""
    if source.cadence_type == "monthly_date":
        # Unlike weekly/biweekly (tied to an exact pay date), a monthly income source
        # doesn't map cleanly onto ~2-week cycles -- rent might get applied toward a
        # bill in a different cycle than the one containing the 1st. So it's treated
        # as available in every cycle from its start date onward, and the user
        # decides per-cycle (via the existing Mark Received toggle) whether they're
        # actually counting it there, instead of the app locking it to one cycle.
        return 1 if period_end >= source.start_date else 0

    if source.cadence_type == "weekly":
        count = 0
        d = period_start
        while d <= period_end:
            # The weekday is derived from start_date itself, not the separately
            # stored cadence_weekday -- the two can drift out of sync if start_date
            # is edited later without also updating the day-of-week, which would
            # otherwise make every occurrence check silently fail forever.
            if d >= source.start_date and d.weekday() == source.start_date.weekday():
                count += 1
            d += datetime.timedelta(days=1)
        return count

    if source.cadence_type == "biweekly":
        count = 0
        d = period_start
        while d <= period_end:
            if (
                d >= source.start_date
                and d.weekday() == source.start_date.weekday()
                and (d - source.start_date).days % 14 == 0
            ):
                count += 1
            d += datetime.timedelta(days=1)
        return count

    if source.cadence_type == "semimonthly":
        days = (source.cadence_day_of_month or 1, source.cadence_day_of_month2 or 31)
        count = 0
        d = period_start
        while d <= period_end:
            if d >= source.start_date and d.day in {_clamp_day(d.year, d.month, x) for x in days}:
                count += 1
            d += datetime.timedelta(days=1)
        return count

    return 0


def cycle_income_entries(db: Session, period: PayPeriod) -> list[IncomeEntry]:
    """Income that funds this cycle. Normally just its own entries; a bridge
    cycle (created when the layout switched, starting after its payday) also
    gets the paycheck recorded on the legacy cycle that shares its pay_date."""
    entries = list(period.income_entries)
    pay = period.pay_date or period.end_date
    if period.start_date > pay:
        siblings = (
            db.query(PayPeriod)
            .filter(PayPeriod.user_id == period.user_id, PayPeriod.pay_date == pay, PayPeriod.id != period.id)
            .all()
        )
        for sibling in siblings:
            entries.extend(sibling.income_entries)
    return entries


def create_period_with_templates(
    db: Session, user_id: int, label: str, start_date, end_date, pay_date=None
) -> PayPeriod:
    # Manually created (custom-mode) cycles keep the legacy meaning: they end
    # on their payday.
    period = PayPeriod(
        user_id=user_id, label=label, start_date=start_date, end_date=end_date, pay_date=pay_date or end_date
    )
    db.add(period)
    db.flush()

    # A bridge cycle (starts after its payday) is funded by the paycheck already
    # recorded on the cycle before it, so it gets no income rows of its own --
    # otherwise "every cycle" monthly incomes would be counted twice.
    is_bridge = pay_date is not None and start_date != pay_date and pay_date < start_date
    for source in ([] if is_bridge else db.query(IncomeSource).filter_by(user_id=user_id, active=True).all()):
        occurrences = compute_income_occurrences(source, start_date, end_date)
        if occurrences == 0:
            continue  # cadence doesn't land in this period -- skip, no phantom row
        db.add(
            IncomeEntry(
                period_id=period.id,
                income_source_id=source.id,
                custom_label=None,
                expected_amount=float(source.amount) * occurrences,
                actual_amount=0,
            )
        )

    # Derived reimbursement bills (shared_access_bill_id set) are excluded here --
    # they don't get a fresh copy in every period like a normal recurring bill;
    # sync_reimbursement_bills_for_viewer manages their single rolling entry
    # instead, so this and that function don't fight over creating duplicates.
    for source in (
        db.query(BillSource)
        .filter_by(user_id=user_id, active=True)
        .filter(BillSource.shared_access_bill_id.is_(None))
        .all()
    ):
        db.add(
            BillEntry(
                period_id=period.id,
                bill_source_id=source.id,
                target_amount=source.default_target_amount,
                actual_amount=0,
            )
        )

    db.commit()
    db.refresh(period)
    return period


def sync_income_entries_for_source(db: Session, source: IncomeSource) -> list[IncomeEntry]:
    """After an income source's cadence or start date changes (or a new one is
    added), add IncomeEntry rows to any of the user's existing periods -- past or
    future -- that now qualify but don't have one yet. Purely additive: never
    touches or removes an entry that already exists, so it's always safe to call
    after an edit."""
    if not source.active:
        return []
    already_covered = {
        e.period_id for e in db.query(IncomeEntry).filter_by(income_source_id=source.id).all()
    }
    created: list[IncomeEntry] = []
    for period in db.query(PayPeriod).filter_by(user_id=source.user_id).all():
        if period.id in already_covered:
            continue
        if period.pay_date is not None and period.pay_date < period.start_date:
            continue  # bridge cycle: funded by the previous cycle's paycheck
        occurrences = compute_income_occurrences(source, period.start_date, period.end_date)
        if occurrences == 0:
            continue
        entry = IncomeEntry(
            period_id=period.id,
            income_source_id=source.id,
            custom_label=None,
            expected_amount=float(source.amount) * occurrences,
            actual_amount=0,
        )
        db.add(entry)
        created.append(entry)
    db.commit()
    return created


def sync_bill_entries_for_source(db: Session, source: BillSource) -> list[BillEntry]:
    """After a bill source is created or edited (e.g. changed category, amount),
    add BillEntry rows to any of the user's existing periods -- past or future --
    that don't have one yet for this source, AND refresh target_amount on any
    existing entry that hasn't actually been touched yet (nothing paid, not
    marked paid) -- an untouched entry is still just a snapshot of the
    recurring default taken at generation time, so an edited default should
    still reach it. Never touches an entry with real payment activity already
    recorded against it, so already-reconciled cycles stay exactly as they
    were. Mirrors sync_income_entries_for_source."""
    if not source.active:
        return []
    existing = db.query(BillEntry).filter_by(bill_source_id=source.id).all()
    already_covered = {e.period_id for e in existing}
    for entry in existing:
        if not entry.is_paid and float(entry.actual_amount) == 0:
            entry.target_amount = source.default_target_amount
    created: list[BillEntry] = []
    for period in db.query(PayPeriod).filter_by(user_id=source.user_id).all():
        if period.id in already_covered:
            continue
        entry = BillEntry(
            period_id=period.id,
            bill_source_id=source.id,
            target_amount=source.default_target_amount,
            actual_amount=0,
        )
        db.add(entry)
        created.append(entry)
    db.commit()
    return created


def remove_untouched_entries_for_source(db: Session, source: BillSource) -> None:
    """When a bill source is deactivated (removed in Setup), clear out any of
    its BillEntry rows that carry no real information -- never paid, nothing
    entered -- so it actually stops showing up on Pay Periods rather than
    lingering everywhere as a stale $0 placeholder. Entries with real payment
    activity already recorded are left alone as history, same "untouched"
    definition used by sync_bill_entries_for_source."""
    db.query(BillEntry).filter(
        BillEntry.bill_source_id == source.id,
        BillEntry.is_paid.is_(False),
        BillEntry.actual_amount == 0,
    ).delete(synchronize_session=False)
    db.commit()


def add_next_period(db: Session, user: User) -> PayPeriod:
    """Manually create exactly one more cycle beyond the user's latest existing
    period, using the same cadence math as the rolling auto-generator -- for
    planning further ahead than the 6-month horizon reaches. Only valid for
    accounts on an auto-generating pay_cycle_mode."""
    if user.cycle_layout != PAYDAY_LAYOUT:
        _switch_to_payday_layout(db, user)
    latest = db.query(PayPeriod).filter_by(user_id=user.id).order_by(PayPeriod.end_date.desc()).first()
    start, end, pay_date = _next_cycle_bounds(user, latest)
    return create_period_with_templates(db, user.id, _cycle_label(start, end, pay_date), start, end, pay_date)


def _switch_to_payday_layout(db: Session, user: User) -> None:
    """One-time move of a legacy account (cycles ending on paydays) to the
    payday layout. Cycles that are past, current, or have any activity are
    left exactly as they are; only untouched future ones are removed, and
    generation resumes after the last kept cycle (via a bridge cycle)."""
    _remove_untouched_periods(db, user, PayPeriod.end_date >= datetime.date.today())
    user.cycle_layout = PAYDAY_LAYOUT
    db.commit()


def ensure_upcoming_periods(
    db: Session, user: User, horizon_months: int = 6, first_payday: Optional[datetime.date] = None
) -> list[PayPeriod]:
    """Keep upcoming Payment Cycles generated out to `horizon_months` months from
    today, for accounts on an auto-generating pay_cycle_mode -- a calendar horizon,
    not a fixed cycle count. No-op for "custom" (fully manual) or an unset mode.
    Safe to call on every page load -- a couple of cheap queries once the window
    is already full. `first_payday` starts a brand-new account's first cycle (from
    onboarding); otherwise an empty account starts at the cycle containing today."""
    if not is_auto_mode(user):
        return []
    if user.cycle_layout != PAYDAY_LAYOUT:
        _switch_to_payday_layout(db, user)

    today = datetime.date.today()
    hy, hm = _add_months(today.year, today.month, horizon_months)
    horizon_end = datetime.date(hy, hm, _clamp_day(hy, hm, today.day))

    latest = db.query(PayPeriod).filter(PayPeriod.user_id == user.id).order_by(PayPeriod.end_date.desc()).first()
    created: list[PayPeriod] = []
    guard = 0
    while guard < 400 and (latest is None or latest.end_date < horizon_end):
        guard += 1
        start, end, pay_date = _next_cycle_bounds(user, latest, first_payday)
        latest = create_period_with_templates(db, user.id, _cycle_label(start, end, pay_date), start, end, pay_date)
        created.append(latest)
    return created


def _period_is_untouched(period: PayPeriod) -> bool:
    if any(float(e.actual_amount) != 0 for e in period.income_entries):
        return False
    if any(float(e.actual_amount) != 0 for e in period.bill_entries):
        return False
    if period.savings_entries:
        return False
    if period.managed_at or period.plan_future_amount is not None or period.plan_fun_amount is not None:
        return False
    if any(e.planned_amount is not None or float(e.deferred_amount or 0) != 0 for e in period.bill_entries):
        return False
    return True


def _remove_untouched_periods(db: Session, user: User, condition) -> int:
    removed = 0
    for period in db.query(PayPeriod).filter(PayPeriod.user_id == user.id, condition).all():
        if _period_is_untouched(period):
            db.delete(period)  # entries go with it (cascade on PayPeriod's relationships)
            removed += 1
    db.commit()
    return removed


def reset_untouched_upcoming_periods(db: Session, user: User) -> int:
    """When the user edits their schedule, clear out future cycles that haven't
    been touched yet (nothing received, paid, saved, or planned) so the
    corrected schedule can regenerate cleanly. The cycle you're in now and any
    cycle with real activity are left alone. Returns how many were removed."""
    return _remove_untouched_periods(db, user, PayPeriod.start_date > datetime.date.today())


def load_user_periods(db: Session, user_id: int) -> list[PayPeriod]:
    """All of a user's cycles with their bill entries (and each entry's bill)
    loaded in three queries total, in the same order compute_owed_balance
    uses. Pages build everything from this instead of querying per bill --
    every query is a network round trip to the database in production."""
    return (
        db.query(PayPeriod)
        .filter(PayPeriod.user_id == user_id)
        .order_by(PayPeriod.start_date, PayPeriod.id)
        .options(selectinload(PayPeriod.bill_entries).selectinload(BillEntry.source))
        .all()
    )


class OwedIndex:
    """compute_owed_balance for many cards at once, from preloaded cycles."""

    def __init__(self, periods: list[PayPeriod]):
        self.position = {p.id: i for i, p in enumerate(periods)}
        self.paid: dict[int, list[tuple[int, float]]] = {}
        self.sources: dict[int, BillSource] = {}
        for i, p in enumerate(periods):
            for e in p.bill_entries:
                self.sources[e.bill_source_id] = e.source
                self.paid.setdefault(e.bill_source_id, []).append((i, float(e.actual_amount)))

    def owed(self, bill_source_id: int, as_of_period_id: int, include_as_of: bool = True) -> float:
        source = self.sources.get(bill_source_id)
        if source is None or as_of_period_id not in self.position:
            return 0.0
        cutoff = self.position[as_of_period_id] + (1 if include_as_of else 0)
        total_paid = sum(amount for i, amount in self.paid.get(bill_source_id, []) if i < cutoff)
        return max(float(source.default_target_amount) - total_paid, 0.0)


def compute_owed_balance(
    db: Session, user_id: int, bill_source_id: int, as_of_period_id: int, include_as_of: bool = True
) -> float:
    """Current balance remaining on a revolving bill (credit card): the source's
    default_target_amount is its standing balance, which every payment made
    against it (across every period up to and including as_of_period_id) pays
    down. Unlike a recurring bill, the balance isn't a fresh charge each period --
    a period where nothing was paid doesn't add another full target_amount on top,
    it just leaves the balance where it was."""
    source = db.query(BillSource).filter_by(id=bill_source_id, user_id=user_id).one_or_none()
    if source is None:
        return 0.0
    periods_in_order = (
        db.execute(
            select(PayPeriod.id).where(PayPeriod.user_id == user_id).order_by(PayPeriod.start_date, PayPeriod.id)
        )
        .scalars()
        .all()
    )
    if as_of_period_id not in periods_in_order:
        return 0.0
    # include_as_of=False gives the balance carried INTO that period (only
    # earlier cycles' payments) -- used as a revolving bill's per-cycle target.
    cutoff = periods_in_order.index(as_of_period_id) + (1 if include_as_of else 0)
    relevant_period_ids = periods_in_order[:cutoff]

    entries = (
        db.query(BillEntry)
        .filter(
            BillEntry.bill_source_id == bill_source_id,
            BillEntry.period_id.in_(relevant_period_ids),
        )
        .all()
    )
    total_paid = sum(float(entry.actual_amount) for entry in entries)
    return max(float(source.default_target_amount) - total_paid, 0.0)


def _project_payoff_date(
    user: User, source: BillSource, current: PayPeriod, periods: list[PayPeriod], today: datetime.date, owed: float
) -> Optional[datetime.date]:
    """When this revolving balance will hit $0. First reads the account's own
    plan: if future cycles already have payments entered against this card
    (e.g. you've mapped out a payoff schedule ahead of time), it walks forward
    through them and reports the exact cycle where the running balance clears
    -- your own numbers, not a guess. Only once it runs out of already-entered
    cycles does it fall back to extrapolating from the average pace of
    everything entered so far. Returns None when there's nothing to project
    from (never been paid, so there's no pace or plan to read)."""
    if owed <= 0:
        return today

    upcoming = sorted([p for p in periods if p.end_date > current.end_date], key=lambda p: p.end_date)
    running = owed
    for p in upcoming:
        paid = sum(float(e.actual_amount) for e in p.bill_entries if e.bill_source_id == source.id)
        running -= paid
        if running <= 0:
            return p.end_date

    # Ran out of already-generated/planned cycles before the balance hit zero --
    # extrapolate from the average pace across everything entered (past actuals
    # plus any already-planned future payments).
    all_relevant = [current] + upcoming
    total_paid = sum(
        float(e.actual_amount) for p in all_relevant for e in p.bill_entries if e.bill_source_id == source.id
    )
    avg_payment = total_paid / len(all_relevant)
    if avg_payment <= 0:
        return None
    cycles_needed = -(-int(running * 100) // int(avg_payment * 100))  # ceil division, cents-safe
    last_end = upcoming[-1].end_date if upcoming else current.end_date

    if is_auto_mode(user):
        end = last_end
        for _ in range(cycles_needed):
            end = next_payday_after(user, end)
        return end

    # "custom" (or unset) has no fixed cadence -- fall back to the account's
    # own average cycle length so far.
    if len(periods) < 2:
        return None
    total_days = (periods[-1].end_date - periods[0].start_date).days
    avg_cycle_days = total_days / (len(periods) - 1)
    if avg_cycle_days <= 0:
        return None
    return last_end + datetime.timedelta(days=round(cycles_needed * avg_cycle_days))


def compute_period_totals(income_entries, bill_entries, savings_entries=()) -> dict:
    total_income = sum(float(e.actual_amount) for e in income_entries)
    total_bills_paid = sum(float(e.actual_amount) for e in bill_entries)
    total_saved = sum(float(e.amount) for e in savings_entries)
    return {
        "total_income": total_income,
        "total_bills_paid": total_bills_paid,
        "total_saved": total_saved,
        "left_over": total_income - total_bills_paid - total_saved,
    }


def find_current_period(periods: list[PayPeriod], today: datetime.date) -> Optional[PayPeriod]:
    """The cycle you're actively living in: the one belonging to the most recent
    payday that has arrived. Among cycles sharing that payday (a legacy cycle
    and the bridge after it), the latest one that has started wins. Falls back
    to the soonest upcoming cycle, else the most recently started one."""
    started = [p for p in periods if (p.pay_date or p.end_date) <= today and p.start_date <= today]
    if started:
        return max(started, key=lambda p: (p.pay_date or p.end_date, p.start_date))
    upcoming = [p for p in periods if p.start_date >= today]
    if upcoming:
        return min(upcoming, key=lambda p: p.start_date)
    if periods:
        return max(periods, key=lambda p: p.start_date)
    return None


def compute_dashboard_summary(db: Session, user: User) -> dict:
    """Everything the At A Glance dashboard needs in one call: current-cycle totals,
    total owed on revolving cards, bills coming due, savings progress across all
    buckets, and real (not projected) monthly/annual bill and income breakdowns
    by category/source -- each cycle's actual amounts are attributed to the
    calendar month/year containing that cycle's pay date."""
    ensure_upcoming_periods(db, user)
    today = datetime.date.today()
    periods = db.query(PayPeriod).filter_by(user_id=user.id).order_by(PayPeriod.start_date).all()
    current = find_current_period(periods, today)

    current_totals = {"total_income": 0.0, "total_bills_paid": 0.0, "total_saved": 0.0, "left_over": 0.0}
    if current is not None:
        current_totals = compute_period_totals(
            cycle_income_entries(db, current), current.bill_entries, current.savings_entries
        )

    total_owed = 0.0
    cards_owed = []
    as_of = current or (periods[-1] if periods else None)
    if as_of is not None:
        for source in db.query(BillSource).filter_by(user_id=user.id, is_revolving=True, active=True).all():
            owed = compute_owed_balance(db, user.id, source.id, as_of.id)
            total_owed += owed
            payoff_date = (
                _project_payoff_date(user, source, as_of, periods, today, owed) if current is not None else None
            )
            cards_owed.append(
                {
                    "bill_source_id": source.id,
                    "name": source.name,
                    "issuer": source.credit_card_issuer,
                    "owed_balance": owed,
                    "projected_payoff_date": payoff_date,
                }
            )
    cards_owed.sort(key=lambda c: -c["owed_balance"])

    # The current cycle's own pay date can already be in the past (it doesn't
    # roll to "next" until that pay date actually hits -- see find_current_period),
    # so it has to be checked explicitly here or an unpaid bill from the cycle
    # you're still in would silently disappear from this list.
    bills_due_soon = []
    relevant_periods = ([current] if current is not None else []) + sorted(
        [p for p in periods if current is None or p.end_date > current.end_date], key=lambda p: p.end_date
    )[:2]
    for p in relevant_periods:
        for entry in p.bill_entries:
            # Revolving cards owe what's carried into this cycle, not the opening
            # balance snapshotted on the entry -- so a card that's been paid off
            # drops off this list instead of showing its original balance.
            target = (
                compute_owed_balance(db, user.id, entry.bill_source_id, p.id, include_as_of=False)
                if entry.source.is_revolving
                else float(entry.target_amount)
            )
            shortfall = target - float(entry.actual_amount)
            if shortfall > 0:
                due_date = _bill_due_date_in_range(p.start_date, p.end_date, entry.source.due_day, p.pay_date)
                if due_date is None:
                    # This bill's due_day doesn't fall in this cycle -- a
                    # different cycle covers its real due date, so this copy
                    # isn't actually due (or overdue) yet.
                    continue
                if _bill_occurrence_satisfied(db, user.id, entry, due_date):
                    # Already handled -- paid (possibly ahead of the due date,
                    # in an earlier cycle) or explicitly marked paid.
                    continue
                bills_due_soon.append(
                    {
                        "bill_source_id": entry.bill_source_id,
                        "name": entry.source.name,
                        "category": entry.source.category,
                        "amount_due": shortfall,
                        "period_label": p.label,
                        "due_date": due_date,
                        "is_overdue": due_date < today,
                    }
                )
    bills_due_soon.sort(key=lambda b: b["due_date"])
    bills_due_soon = bills_due_soon[:8]

    buckets = db.query(SavingsBucket).filter_by(user_id=user.id).all()
    total_saved_all_buckets = sum(sum(float(e.amount) for e in b.entries) for b in buckets)
    goals = [float(b.goal_amount) for b in buckets if b.goal_amount is not None]
    total_savings_goal = sum(goals) if goals else None

    # Real sums of what's actually been paid, not a projection -- a cycle's paid
    # bills count toward the calendar month/year containing that cycle's pay
    # date (end_date). Revolving bills (credit cards) are excluded -- they're
    # already represented by total_owed above, and a payment against one is a
    # balance paydown, not a fresh recurring charge.
    monthly_by_category: dict[str, float] = {}
    annual_by_category: dict[str, float] = {}
    cycle_by_category: dict[str, float] = {}
    if current is not None:
        for entry in current.bill_entries:
            if entry.source.is_revolving or float(entry.actual_amount) <= 0:
                continue
            cycle_by_category[entry.source.category] = cycle_by_category.get(entry.source.category, 0.0) + float(
                entry.actual_amount
            )
    for p in periods:
        pay = p.pay_date or p.end_date
        if pay.year != today.year:
            continue
        for entry in p.bill_entries:
            if entry.source.is_revolving or float(entry.actual_amount) <= 0:
                continue
            amount = float(entry.actual_amount)
            annual_by_category[entry.source.category] = annual_by_category.get(entry.source.category, 0.0) + amount
            if pay.month == today.month:
                monthly_by_category[entry.source.category] = (
                    monthly_by_category.get(entry.source.category, 0.0) + amount
                )

    bill_categories = []
    # Union with the cycle's categories: in early January the current cycle can
    # hold payments that belong to no current-year bucket yet.
    for category in sorted(set(annual_by_category) | set(cycle_by_category), key=lambda c: -monthly_by_category.get(c, 0.0)):
        bill_categories.append(
            {
                "category": category,
                "monthly": monthly_by_category.get(category, 0.0),
                "annual": annual_by_category.get(category, 0.0),
                "cycle": cycle_by_category.get(category, 0.0),
            }
        )
    monthly_bills_total = sum(monthly_by_category.values())
    annual_bills_total = sum(annual_by_category.values())

    # Same real-sum treatment for income: each cycle's actually-received income
    # counts toward the calendar month/year containing that cycle's pay date,
    # grouped by source name (income sources have no category, unlike bills).
    monthly_income_by_source: dict[str, float] = {}
    annual_income_by_source: dict[str, float] = {}
    cycle_income_by_source: dict[str, float] = {}
    if current is not None:
        for entry in cycle_income_entries(db, current):
            if float(entry.actual_amount) <= 0:
                continue
            name = entry.source.name if entry.income_source_id else entry.custom_label
            cycle_income_by_source[name] = cycle_income_by_source.get(name, 0.0) + float(entry.actual_amount)
    for p in periods:
        pay = p.pay_date or p.end_date
        if pay.year != today.year:
            continue
        for entry in p.income_entries:
            if float(entry.actual_amount) <= 0:
                continue
            name = entry.source.name if entry.income_source_id else entry.custom_label
            amount = float(entry.actual_amount)
            annual_income_by_source[name] = annual_income_by_source.get(name, 0.0) + amount
            if pay.month == today.month:
                monthly_income_by_source[name] = monthly_income_by_source.get(name, 0.0) + amount

    income_sources_breakdown = []
    for name in sorted(
        set(annual_income_by_source) | set(cycle_income_by_source), key=lambda n: -monthly_income_by_source.get(n, 0.0)
    ):
        income_sources_breakdown.append(
            {
                "category": name,
                "monthly": monthly_income_by_source.get(name, 0.0),
                "annual": annual_income_by_source.get(name, 0.0),
                "cycle": cycle_income_by_source.get(name, 0.0),
            }
        )
    monthly_income_total = sum(monthly_income_by_source.values())
    annual_income_total = sum(annual_income_by_source.values())

    # Rough monthly income estimate (for the bills-as-%-of-income figure only) --
    # each income source's per-occurrence amount times its own typical annual
    # occurrence count. An estimate, not a real total.
    monthly_income_estimate = None
    income_sources = db.query(IncomeSource).filter_by(user_id=user.id, active=True).all()
    if income_sources:
        occurrence_map = {"monthly_date": 12, "weekly": 52, "biweekly": 26}
        annual_income = sum(float(s.amount) * occurrence_map.get(s.cadence_type, 12) for s in income_sources)
        monthly_income_estimate = annual_income / 12

    # Per-cycle estimates: averages over completed cycles before the current
    # one. Cycles with nothing received and nothing paid are skipped -- those
    # are auto-generated placeholders from before the user started tracking,
    # and counting them as $0 would drag the average down. One-time income and
    # revolving (credit card) payments are left out, matching the "recurring"
    # framing of the rest of the page.
    estimated_income_per_cycle = None
    estimated_bills_per_cycle = None
    # Grouped by payday, so a legacy cycle and the bridge after it (same
    # paycheck) count as one cycle.
    past_active = []
    if current is not None:
        current_pay = current.pay_date or current.end_date
        groups: dict[datetime.date, list[PayPeriod]] = {}
        for p in periods:
            pay = p.pay_date or p.end_date
            if pay < current_pay:
                groups.setdefault(pay, []).append(p)
        for group in groups.values():
            income_entries = [e for p in group for e in p.income_entries]
            bill_entries = [e for p in group for e in p.bill_entries]
            income = sum(float(e.actual_amount) for e in income_entries if e.income_source_id is not None)
            bills = sum(float(e.actual_amount) for e in bill_entries if not e.source.is_revolving)
            if any(float(e.actual_amount) > 0 for e in income_entries + bill_entries):
                past_active.append((income, bills))
    if past_active:
        estimated_income_per_cycle = sum(i for i, _ in past_active) / len(past_active)
        estimated_bills_per_cycle = sum(b for _, b in past_active) / len(past_active)

    # Cycles per year, to scale per-cycle estimates to Monthly/Annual views.
    cycles_per_year = {"weekly": 52.0, "biweekly": 26.0, "monthly": 12.0}.get(user.pay_cycle_mode or "", 0.0)
    if not cycles_per_year:
        spans = [(p.end_date - p.start_date).days + 1 for p in periods]
        avg_days = sum(spans) / len(spans) if spans else 0
        cycles_per_year = round(365 / avg_days, 2) if avg_days > 0 else 26.0

    bills_percent_of_income = None
    if monthly_income_estimate and monthly_income_estimate > 0:
        bills_percent_of_income = round((monthly_bills_total / monthly_income_estimate) * 100, 1)

    return {
        "current_period_id": current.id if current else None,
        "current_period_label": current.label if current else None,
        "current_total_income": current_totals["total_income"],
        "current_total_bills_paid": current_totals["total_bills_paid"],
        "current_total_saved": current_totals["total_saved"],
        "current_left_over": current_totals["left_over"],
        "total_owed": total_owed,
        "cards_owed": cards_owed,
        "bills_due_soon": bills_due_soon,
        "total_saved_all_buckets": total_saved_all_buckets,
        "total_savings_goal": total_savings_goal,
        "bill_categories": bill_categories,
        "monthly_bills_total": monthly_bills_total,
        "annual_bills_total": annual_bills_total,
        "income_sources": income_sources_breakdown,
        "monthly_income_total": monthly_income_total,
        "annual_income_total": annual_income_total,
        "monthly_income_estimate": monthly_income_estimate,
        "bills_percent_of_income": bills_percent_of_income,
        "cycle_bills_total": sum(cycle_by_category.values()),
        "cycle_income_total": sum(cycle_income_by_source.values()),
        "estimated_income_per_cycle": estimated_income_per_cycle,
        "estimated_bills_per_cycle": estimated_bills_per_cycle,
        "estimate_cycle_count": len(past_active),
        "cycles_per_year": cycles_per_year,
    }


def split_count_for_bill(db: Session, owner_id: int, bill_source_id: int) -> int:
    """1 (the owner) plus everyone else this bill is actually shared with --
    so a bill shared with 2 other people splits 3 ways total, including the
    owner's own share. Counts distinct viewer emails, so sharing the same
    bill with the same person twice (across separate relationships) doesn't
    double-count them."""
    viewer_emails = (
        db.query(SharedAccess.viewer_email)
        .join(SharedAccessBill, SharedAccessBill.shared_access_id == SharedAccess.id)
        .filter(SharedAccess.owner_id == owner_id, SharedAccessBill.bill_source_id == bill_source_id)
        .distinct()
        .all()
    )
    return 1 + len(viewer_emails)


def detach_reimbursement_bills(db: Session, shared_access_bill_ids: list[int]) -> None:
    """Call before deleting SharedAccessBill rows. Viewers' derived
    reimbursement bills hold a foreign key to those rows, which Postgres
    enforces, so the delete would fail. Unlinking and deactivating them is the
    same end state sync_reimbursement_bills_for_viewer gives a link that stops
    applying: hidden going forward, past payment history kept."""
    if not shared_access_bill_ids:
        return
    db.query(BillSource).filter(BillSource.shared_access_bill_id.in_(shared_access_bill_ids)).update(
        {BillSource.shared_access_bill_id: None, BillSource.active: False}, synchronize_session=False
    )


def sync_reimbursement_bills_for_viewer(db: Session, viewer: User) -> None:
    """Auto-provision (and keep in sync) a lightweight bill in the viewer's
    own account for every bill someone has split with them -- so they can
    check it off in their own Pay Periods when they actually reimburse the
    owner, independent of whether the owner has paid the real bill. Each
    derived bill is tied 1:1 to a SharedAccessBill row via
    BillSource.shared_access_bill_id, and deactivates automatically once that
    link stops applying (partner removed, bill deleted, or the owner turns
    off splitting) -- mirrors how a deleted-with-history bill deactivates
    rather than disappearing, so past reimbursement history survives."""
    viewer_email = viewer.email.strip().lower()

    # sab.id -> (owner BillSource, this occurrence's split amount)
    active_links: dict[int, tuple[BillSource, float]] = {}
    shares = db.query(SharedAccess).filter_by(viewer_email=viewer_email).all()
    for shared in shares:
        for sab in shared.shared_bills:
            owner_source = sab.bill_source
            if not owner_source.active or not owner_source.split_shared:
                continue
            split_count = split_count_for_bill(db, owner_source.user_id, owner_source.id)
            active_links[sab.id] = (owner_source, float(owner_source.default_target_amount) / split_count)

    existing_derived = (
        db.query(BillSource)
        .filter(BillSource.user_id == viewer.id, BillSource.shared_access_bill_id.isnot(None))
        .all()
    )
    existing_by_link = {s.shared_access_bill_id: s for s in existing_derived}

    for sab_id, (owner_source, split_amount) in active_links.items():
        owner = db.query(User).filter_by(id=owner_source.user_id).one()
        name = f"{owner_source.name} (your share, owed to {owner.name or owner.email})"
        derived = existing_by_link.get(sab_id)
        if derived is None:
            derived = BillSource(
                user_id=viewer.id,
                name=name,
                category=owner_source.category,
                default_target_amount=split_amount,
                is_revolving=False,
                active=True,
                due_day=owner_source.due_day,
                shared_access_bill_id=sab_id,
            )
            db.add(derived)
            db.commit()
        else:
            changed = False
            if derived.name != name:
                derived.name = name
                changed = True
            if derived.category != owner_source.category:
                derived.category = owner_source.category
                changed = True
            if derived.due_day != owner_source.due_day:
                derived.due_day = owner_source.due_day
                changed = True
            if not derived.active:
                derived.active = True
                changed = True
            if float(derived.default_target_amount) != split_amount:
                derived.default_target_amount = split_amount
                changed = True
            if changed:
                db.commit()

        # Unlike a normal recurring bill, a reimbursement isn't pre-populated
        # into every period -- it's a single rolling balance that only lives
        # in the viewer's current cycle, and stays there (rolling forward each
        # time "current" advances) for as long as it's unpaid. Once paid, it's
        # left alone as a historical record rather than spawning a fresh copy.
        viewer_periods = db.query(PayPeriod).filter_by(user_id=viewer.id).order_by(PayPeriod.start_date).all()
        current = find_current_period(viewer_periods, datetime.date.today())
        if current is None:
            continue
        entries = db.query(BillEntry).filter_by(bill_source_id=derived.id).all()
        open_entry = next((e for e in entries if not e.is_paid), None)
        if open_entry is not None:
            entry_changed = False
            if open_entry.period_id != current.id:
                open_entry.period_id = current.id
                entry_changed = True
            if float(open_entry.target_amount) != split_amount:
                open_entry.target_amount = split_amount
                entry_changed = True
            if entry_changed:
                db.commit()
        elif not entries:
            # Never had one before -- create the first one, in the current
            # cycle. If entries already exist but all are paid (e.g. paid
            # ahead of schedule, sitting in a future period), leave it alone
            # rather than spawning a duplicate unpaid copy in current.
            db.add(BillEntry(period_id=current.id, bill_source_id=derived.id, target_amount=split_amount, actual_amount=0))
            db.commit()

    for sab_id, source in existing_by_link.items():
        if sab_id not in active_links and source.active:
            source.active = False
            db.commit()


def compute_bill_calendar(db: Session, user: User) -> list[dict]:
    """Every real occurrence of a bill's due_day, across every cycle the
    account has -- only for bills that actually have a due_day set (Setup >
    Bills), since a calendar entry needs a real date, not a fallback guess.
    Paid/overdue status uses the same "occurrence satisfied" rule as
    everywhere else, so paying ahead of the due date in an earlier cycle (or
    just checking "paid") is reflected here too."""
    today = datetime.date.today()
    periods = load_user_periods(db, user.id)
    entries = []
    for p in periods:
        for entry in p.bill_entries:
            if entry.source.due_day is None:
                continue
            due_date = _bill_due_date_in_range(p.start_date, p.end_date, entry.source.due_day, p.pay_date)
            if due_date is None:
                continue
            satisfied = _bill_occurrence_satisfied(db, user.id, entry, due_date, periods)
            entries.append(
                {
                    "date": due_date,
                    "bill_source_id": entry.bill_source_id,
                    "name": entry.source.name,
                    "category": entry.source.category,
                    "amount": float(entry.target_amount),
                    "is_paid": satisfied,
                    "is_overdue": (not satisfied) and due_date < today,
                    "period_id": p.id,
                    "period_label": p.label,
                }
            )
    entries.sort(key=lambda e: e["date"])
    return entries


def compute_shared_view(db: Session, shared: SharedAccess) -> dict:
    """The read-only snapshot a viewer sees for one incoming SharedAccess grant:
    just the owner's current cycle, filtered down to only the bill/income
    sources the owner actually chose to share. Reuses the exact same
    due-date/overdue logic as the owner's own period page, so a shared bill
    paid early in an earlier cycle correctly shows as handled here too."""
    owner = db.query(User).filter_by(id=shared.owner_id).one_or_none()
    if owner is None:
        return {
            "shared_access_id": shared.id,
            "owner_email": "",
            "label": shared.label,
            "current_period_label": None,
            "bills": [],
            "income": [],
        }
    ensure_upcoming_periods(db, owner)
    periods = db.query(PayPeriod).filter_by(user_id=owner.id).order_by(PayPeriod.start_date).all()
    current = find_current_period(periods, datetime.date.today())

    bills: list[dict] = []
    income: list[dict] = []
    if current is not None:
        shared_bill_ids = {sb.bill_source_id for sb in shared.shared_bills}
        shared_income_ids = {si.income_source_id for si in shared.shared_income}

        for entry in current.bill_entries:
            if entry.bill_source_id not in shared_bill_ids:
                continue
            due_date = (
                _bill_due_date_in_range(current.start_date, current.end_date, entry.source.due_day, current.pay_date)
                if entry.source.due_day is not None
                else None
            )
            is_overdue = (
                due_date is not None
                and due_date < datetime.date.today()
                and not _bill_occurrence_satisfied(db, owner.id, entry, due_date)
            )
            split_count = split_count_for_bill(db, owner.id, entry.bill_source_id) if entry.source.split_shared else 1
            split_amount = float(entry.target_amount) / split_count
            bills.append(
                {
                    "bill_source_id": entry.bill_source_id,
                    "name": entry.source.name,
                    "category": entry.source.category,
                    "target_amount": float(entry.target_amount),
                    "actual_amount": float(entry.actual_amount),
                    "is_paid": entry.is_paid,
                    "due_date": due_date,
                    "is_overdue": is_overdue,
                    "split_shared": entry.source.split_shared,
                    "split_count": split_count,
                    "split_amount": split_amount,
                }
            )

        for entry in current.income_entries:
            if entry.income_source_id not in shared_income_ids:
                continue
            income.append(
                {
                    "income_source_id": entry.income_source_id,
                    "name": entry.source.name if entry.source else (entry.custom_label or ""),
                    "expected_amount": float(entry.expected_amount),
                    "actual_amount": float(entry.actual_amount),
                    "is_received": entry.is_received,
                }
            )

    return {
        "shared_access_id": shared.id,
        "owner_email": owner.email,
        "owner_name": owner.name,
        "label": shared.label,
        "current_period_label": current.label if current else None,
        "bills": bills,
        "income": income,
    }
