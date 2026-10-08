import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import BillEntry, BillSource, IncomeSource, PayPeriod, SavingsBucket, User
from app.services.events import log_event
from app.services.period_service import PAYDAY_LAYOUT, ensure_upcoming_periods
from app.services.plan_service import (
    build_plan,
    confirm_plan,
    current_plan_period,
    plan_period_for,
    put_rest_in_fun,
    update_bill_plan,
    update_plan,
)

router = APIRouter(tags=["plan"])


class PlanUpdate(BaseModel):
    future_amount: Optional[float] = None
    future_bucket_id: Optional[int] = None
    fun_amount: Optional[float] = None
    # Which of the fields above to apply (so null can mean "clear")
    fields: list[str] = []


class BillPlanUpdate(BaseModel):
    planned_amount: Optional[float] = None  # null = back to the default
    deferred_amount: float = 0


def _plan_period_or_404(db: Session, period_id: int, user: User) -> PayPeriod:
    period = db.query(PayPeriod).filter_by(id=period_id, user_id=user.id).one_or_none()
    if period is None:
        raise HTTPException(status_code=404, detail=f"No such payment cycle: {period_id}")
    plan_period = plan_period_for(db, period)
    if plan_period is None:
        raise HTTPException(status_code=400, detail="This cycle can't be planned")
    return plan_period


@router.get("/plan/current")
def get_current_plan(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_upcoming_periods(db, current_user)
    period = current_plan_period(db, current_user)
    if period is None:
        return {"plannable": False, "period_id": None, "name": current_user.name}
    return {**build_plan(db, current_user, period), "name": current_user.name}


@router.get("/plan/{period_id}")
def get_plan(period_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    period = db.query(PayPeriod).filter_by(id=period_id, user_id=current_user.id).one_or_none()
    if period is None:
        raise HTTPException(status_code=404, detail=f"No such payment cycle: {period_id}")
    return {**build_plan(db, current_user, period), "name": current_user.name}


@router.patch("/plan/{period_id}")
def patch_plan(
    period_id: int, payload: PlanUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    period = _plan_period_or_404(db, period_id, current_user)
    kwargs = {}
    for field in payload.fields:
        if field not in ("future_amount", "future_bucket_id", "fun_amount"):
            raise HTTPException(status_code=400, detail=f"Unknown field: {field}")
        kwargs[field] = getattr(payload, field)
    if kwargs.get("future_bucket_id"):
        if db.query(SavingsBucket).filter_by(id=kwargs["future_bucket_id"], user_id=current_user.id).one_or_none() is None:
            raise HTTPException(status_code=404, detail="No such savings bucket")
    update_plan(db, period, **kwargs)
    return build_plan(db, current_user, period)


@router.patch("/plan/{period_id}/bills/{entry_id}")
def patch_bill_plan(
    period_id: int,
    entry_id: int,
    payload: BillPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period = _plan_period_or_404(db, period_id, current_user)
    entry = db.query(BillEntry).join(PayPeriod).filter(
        BillEntry.id == entry_id, PayPeriod.user_id == current_user.id, PayPeriod.pay_date == period.pay_date
    ).one_or_none()
    if entry is None:
        raise HTTPException(status_code=404, detail=f"No such bill in this paycheck: {entry_id}")
    update_bill_plan(db, period, entry, payload.planned_amount, payload.deferred_amount)
    return build_plan(db, current_user, period)


@router.post("/plan/{period_id}/fill-fun")
def fill_fun(period_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    period = _plan_period_or_404(db, period_id, current_user)
    put_rest_in_fun(db, current_user, period)
    return build_plan(db, current_user, period)


@router.post("/plan/{period_id}/confirm")
def confirm(period_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    period = _plan_period_or_404(db, period_id, current_user)
    plan = confirm_plan(db, current_user, period)
    if not plan.get("managed_at"):
        raise HTTPException(status_code=400, detail="Every dollar needs a job before you can confirm")
    return plan


# ── Onboarding ───────────────────────────────────────────────────────────────


class OnboardingBill(BaseModel):
    name: str
    amount: float
    due_day: Optional[int] = None
    category: str = "Other"


class OnboardingIn(BaseModel):
    take_home: float
    schedule: str  # weekly | biweekly | semimonthly | monthly
    next_payday: datetime.date
    second_pay_day: Optional[int] = None  # semimonthly only; the other day is next_payday.day
    bills: list[OnboardingBill] = []


_CADENCE = {"weekly": "weekly", "biweekly": "biweekly", "semimonthly": "semimonthly", "monthly": "monthly_date"}


@router.post("/onboarding")
def onboarding(payload: OnboardingIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The 90-second setup: one paycheck, a schedule, a few bills. Creates the
    pay schedule, income source, and bills, generates cycles starting at the
    next payday, and returns the first cycle to plan."""
    if current_user.pay_cycle_mode is not None:
        raise HTTPException(status_code=409, detail="Your pay schedule is already set up")
    if payload.take_home <= 0:
        raise HTTPException(status_code=400, detail="Enter what you usually take home per paycheck")
    if payload.schedule not in _CADENCE:
        raise HTTPException(status_code=400, detail="Pick a pay schedule")
    payday = payload.next_payday
    if payday < datetime.date.today() - datetime.timedelta(days=31):
        raise HTTPException(status_code=400, detail="Pick your next (or most recent) payday")

    user = current_user
    user.pay_cycle_mode = payload.schedule
    user.cycle_layout = PAYDAY_LAYOUT
    second = None
    if payload.schedule in ("weekly", "biweekly"):
        user.pay_cycle_anchor_date = payday
    elif payload.schedule == "monthly":
        user.pay_cycle_anchor_day = payday.day
    else:
        second = payload.second_pay_day
        if second is None or not (1 <= second <= 31) or second == payday.day:
            raise HTTPException(status_code=400, detail="Pick your second pay day of the month")
        user.pay_cycle_anchor_day, user.pay_cycle_anchor_day2 = sorted((payday.day, second))

    db.add(
        IncomeSource(
            user_id=user.id,
            name="Paycheck",
            cadence_type=_CADENCE[payload.schedule],
            cadence_day_of_month=payday.day if payload.schedule in ("monthly", "semimonthly") else None,
            cadence_day_of_month2=second,
            cadence_weekday=payday.weekday() if payload.schedule in ("weekly", "biweekly") else None,
            start_date=payday,
            amount=payload.take_home,
        )
    )
    for bill in payload.bills:
        name = bill.name.strip()
        if not name or bill.amount <= 0:
            continue
        due_day = bill.due_day if bill.due_day and 1 <= bill.due_day <= 31 else None
        db.add(
            BillSource(
                user_id=user.id, name=name, category=bill.category or "Other",
                default_target_amount=bill.amount, due_day=due_day,
            )
        )
    db.commit()

    created = ensure_upcoming_periods(db, user, first_payday=payday)
    log_event(db, user.id, "onboarding_completed", bills=len(payload.bills), schedule=payload.schedule)
    db.commit()
    first = min(created, key=lambda p: p.start_date) if created else None
    return {"first_period_id": first.id if first else None}
