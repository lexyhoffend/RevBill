import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import BillEntry, IncomeEntry, PayPeriod, SavingsBucket, SavingsEntry, User
from app.schemas import (
    BillCalendarEntry,
    BillEntryOut,
    BillEntryUpdate,
    DashboardSummary,
    IncomeEntryOut,
    IncomeEntryUpdate,
    OneTimeIncomeCreate,
    PayPeriodCreate,
    PayPeriodDetail,
    PayPeriodOut,
    PayPeriodSummary,
    PeriodSavingsEntryCreate,
    PeriodSavingsEntryOut,
)
from app.services.period_service import (
    add_next_period,
    compute_bill_calendar,
    compute_dashboard_summary,
    compute_owed_balance,
    compute_period_totals,
    create_period_with_templates,
    ensure_upcoming_periods,
    find_overlapping_period,
    split_count_for_bill,
    sync_reimbursement_bills_for_viewer,
    _bill_due_date_in_range,
    _bill_occurrence_satisfied,
)

router = APIRouter(prefix="/periods", tags=["periods"])


def _income_entry_out(e: IncomeEntry) -> IncomeEntryOut:
    is_one_time = e.income_source_id is None
    return IncomeEntryOut(
        id=e.id,
        income_source_id=e.income_source_id,
        source_name=e.custom_label if is_one_time else e.source.name,
        is_one_time=is_one_time,
        expected_amount=float(e.expected_amount),
        actual_amount=float(e.actual_amount),
        is_received=e.is_received,
    )


def _bill_entry_out(db: Session, user_id: int, e: BillEntry, period_id: int) -> BillEntryOut:
    # Always surface the bill's real due date for this cycle (if it has one) --
    # shown next to every bill row on the period page regardless of paid status,
    # so it's a plain reference date, not just an "still outstanding" flag.
    due_date = (
        _bill_due_date_in_range(e.period.start_date, e.period.end_date, e.source.due_day)
        if e.source.due_day is not None
        else None
    )
    # Overdue is about whether the due date itself has been satisfied -- possibly
    # by a payment made ahead of time in an earlier cycle -- not just whether
    # *this* period's own entry happens to be marked paid.
    is_overdue = (
        due_date is not None
        and due_date < datetime.date.today()
        and not _bill_occurrence_satisfied(db, user_id, e, due_date)
    )
    split_count = split_count_for_bill(db, user_id, e.bill_source_id) if e.source.split_shared else 1
    return BillEntryOut(
        id=e.id,
        bill_source_id=e.bill_source_id,
        source_name=e.source.name,
        category=e.source.category,
        is_revolving=e.source.is_revolving,
        target_amount=float(e.target_amount),
        actual_amount=float(e.actual_amount),
        is_paid=e.is_paid,
        owed_balance=(
            compute_owed_balance(db, user_id, e.bill_source_id, period_id) if e.source.is_revolving else 0.0
        ),
        due_date=due_date,
        due_day=e.source.due_day,
        is_overdue=is_overdue,
        split_shared=e.source.split_shared,
        split_count=split_count,
        split_amount=float(e.target_amount) / split_count,
    )


def _savings_entry_out(e: SavingsEntry) -> PeriodSavingsEntryOut:
    return PeriodSavingsEntryOut(id=e.id, bucket_id=e.bucket_id, bucket_name=e.bucket.name, amount=float(e.amount))


@router.get("", response_model=list[PayPeriodOut])
def list_periods(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_upcoming_periods(db, current_user)
    sync_reimbursement_bills_for_viewer(db, current_user)
    return db.query(PayPeriod).filter_by(user_id=current_user.id).order_by(PayPeriod.start_date).all()


@router.post("", response_model=PayPeriodOut)
def create_period(
    payload: PayPeriodCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    overlapping = find_overlapping_period(db, current_user.id, payload.start_date, payload.end_date)
    if overlapping is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"You already have a payment cycle covering these dates: "
                f"'{overlapping.label}' ({overlapping.start_date} to {overlapping.end_date})."
            ),
        )
    period = create_period_with_templates(
        db, current_user.id, payload.label, payload.start_date, payload.end_date
    )
    return period


@router.post("/generate-next", response_model=PayPeriodOut)
def create_next_period(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Manually add one more cycle beyond the account's latest one, for planning
    further out than the rolling 6-month auto-generation horizon reaches. Only for
    accounts on an auto-generating pay_cycle_mode -- "custom" accounts already add
    cycles manually via POST /periods."""
    if not current_user.pay_cycle_mode or current_user.pay_cycle_mode == "custom":
        raise HTTPException(
            status_code=400, detail="This account isn't on an auto-generating pay cycle schedule."
        )
    return add_next_period(db, current_user)


@router.get("/summary", response_model=list[PayPeriodSummary])
def list_periods_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_upcoming_periods(db, current_user)
    sync_reimbursement_bills_for_viewer(db, current_user)
    periods = db.query(PayPeriod).filter_by(user_id=current_user.id).order_by(PayPeriod.start_date).all()
    result = []
    for period in periods:
        totals = compute_period_totals(period.income_entries, period.bill_entries, period.savings_entries)
        result.append(
            PayPeriodSummary(
                id=period.id,
                label=period.label,
                start_date=period.start_date,
                end_date=period.end_date,
                **totals,
            )
        )
    return result


@router.get("/dashboard-summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sync_reimbursement_bills_for_viewer(db, current_user)
    return compute_dashboard_summary(db, current_user)


@router.get("/calendar", response_model=list[BillCalendarEntry])
def bill_calendar(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_upcoming_periods(db, current_user)
    return compute_bill_calendar(db, current_user)


@router.delete("/{period_id}")
def delete_period(period_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    period = db.query(PayPeriod).filter_by(id=period_id, user_id=current_user.id).one_or_none()
    if period is None:
        raise HTTPException(status_code=404, detail=f"No such payment cycle: {period_id}")
    db.query(IncomeEntry).filter_by(period_id=period_id).delete()
    db.query(BillEntry).filter_by(period_id=period_id).delete()
    db.query(SavingsEntry).filter_by(period_id=period_id).delete()
    db.delete(period)
    db.commit()
    return {"deleted": True}


def _get_period_or_404(db: Session, period_id: int, user_id: int) -> PayPeriod:
    period = db.query(PayPeriod).filter_by(id=period_id, user_id=user_id).one_or_none()
    if period is None:
        raise HTTPException(status_code=404, detail=f"No such period: {period_id}")
    return period


@router.get("/{period_id}", response_model=PayPeriodDetail)
def get_period(period_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    period = _get_period_or_404(db, period_id, current_user.id)

    income_out = [_income_entry_out(e) for e in period.income_entries]
    bill_out = [_bill_entry_out(db, current_user.id, e, period_id) for e in period.bill_entries]
    savings_out = [_savings_entry_out(e) for e in period.savings_entries]
    totals = compute_period_totals(period.income_entries, period.bill_entries, period.savings_entries)

    return PayPeriodDetail(
        id=period.id,
        label=period.label,
        start_date=period.start_date,
        end_date=period.end_date,
        income_entries=income_out,
        bill_entries=bill_out,
        savings_entries=savings_out,
        **totals,
    )


@router.post("/{period_id}/savings-entries", response_model=PeriodSavingsEntryOut)
def add_period_savings_entry(
    period_id: int,
    payload: PeriodSavingsEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Move a portion of what's left this period into a savings bucket."""
    _get_period_or_404(db, period_id, current_user.id)
    bucket = db.query(SavingsBucket).filter_by(id=payload.bucket_id, user_id=current_user.id).one_or_none()
    if bucket is None:
        raise HTTPException(status_code=404, detail=f"No such savings bucket: {payload.bucket_id}")
    entry = SavingsEntry(period_id=period_id, bucket_id=payload.bucket_id, amount=payload.amount)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _savings_entry_out(entry)


@router.post("/{period_id}/income-entries", response_model=IncomeEntryOut)
def add_one_time_income(
    period_id: int,
    payload: OneTimeIncomeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ad-hoc income not tied to a recurring Payment Cycle -- e.g. a single Rover
    dog-sitting payment. Scoped to this period only; never copied into future periods."""
    _get_period_or_404(db, period_id, current_user.id)
    entry = IncomeEntry(
        period_id=period_id,
        income_source_id=None,
        custom_label=payload.label,
        expected_amount=payload.amount,
        actual_amount=payload.amount,  # already received, not a future expectation
        is_received=True,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _income_entry_out(entry)


def _get_income_entry_or_404(db: Session, entry_id: int, user_id: int) -> IncomeEntry:
    entry = (
        db.query(IncomeEntry)
        .join(PayPeriod)
        .filter(IncomeEntry.id == entry_id, PayPeriod.user_id == user_id)
        .one_or_none()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail=f"No such income entry: {entry_id}")
    return entry


@router.patch("/income-entries/{entry_id}", response_model=IncomeEntryOut)
def update_income_entry(
    entry_id: int,
    payload: IncomeEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = _get_income_entry_or_404(db, entry_id, current_user.id)
    if payload.expected_amount is not None:
        entry.expected_amount = payload.expected_amount
    if payload.actual_amount is not None:
        entry.actual_amount = payload.actual_amount
    if payload.is_received is not None:
        entry.is_received = payload.is_received
    db.commit()
    db.refresh(entry)
    return _income_entry_out(entry)


def _get_bill_entry_or_404(db: Session, entry_id: int, user_id: int) -> BillEntry:
    entry = (
        db.query(BillEntry)
        .join(PayPeriod)
        .filter(BillEntry.id == entry_id, PayPeriod.user_id == user_id)
        .one_or_none()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail=f"No such bill entry: {entry_id}")
    return entry


@router.patch("/bill-entries/{entry_id}", response_model=BillEntryOut)
def update_bill_entry(
    entry_id: int,
    payload: BillEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = _get_bill_entry_or_404(db, entry_id, current_user.id)
    if payload.target_amount is not None:
        entry.target_amount = payload.target_amount
    if payload.actual_amount is not None:
        entry.actual_amount = payload.actual_amount
    if payload.is_paid is not None:
        entry.is_paid = payload.is_paid
    db.commit()
    db.refresh(entry)
    return _bill_entry_out(db, current_user.id, entry, entry.period_id)
