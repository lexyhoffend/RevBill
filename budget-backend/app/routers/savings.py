from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import PayPeriod, SavingsBucket, SavingsEntry, User
from app.schemas import (
    AddToBucketBalance,
    SavingsBucketIn,
    SavingsBucketOut,
    SavingsBucketUpdate,
    SavingsEntryIn,
    SavingsEntryOut,
)

router = APIRouter(prefix="/savings", tags=["savings"])


def _bucket_out(bucket: SavingsBucket) -> SavingsBucketOut:
    total_saved = sum(float(e.amount) for e in bucket.entries)
    goal = float(bucket.goal_amount) if bucket.goal_amount is not None else None
    percent = round((total_saved / goal) * 100, 1) if goal and goal > 0 else None
    return SavingsBucketOut(
        id=bucket.id,
        name=bucket.name,
        goal_amount=goal,
        total_saved=total_saved,
        percent_complete=percent,
    )


@router.get("/buckets", response_model=list[SavingsBucketOut])
def list_buckets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    buckets = db.query(SavingsBucket).filter_by(user_id=current_user.id).all()
    return [_bucket_out(b) for b in buckets]


@router.post("/buckets", response_model=SavingsBucketOut)
def create_bucket(
    payload: SavingsBucketIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    bucket = SavingsBucket(user_id=current_user.id, name=payload.name, goal_amount=payload.goal_amount)
    db.add(bucket)
    db.flush()

    if payload.starting_balance:
        db.add(
            SavingsEntry(
                bucket_id=bucket.id,
                period_id=None,
                amount=payload.starting_balance,
                note="Starting balance",
            )
        )

    db.commit()
    db.refresh(bucket)
    return _bucket_out(bucket)


def _get_bucket_or_404(db: Session, bucket_id: int, user_id: int) -> SavingsBucket:
    bucket = db.query(SavingsBucket).filter_by(id=bucket_id, user_id=user_id).one_or_none()
    if bucket is None:
        raise HTTPException(status_code=404, detail=f"No such savings bucket: {bucket_id}")
    return bucket


@router.get("/buckets/{bucket_id}/entries", response_model=list[SavingsEntryOut])
def list_bucket_entries(
    bucket_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Statement of every deposit into this bucket, most recent first."""
    bucket = _get_bucket_or_404(db, bucket_id, current_user.id)
    entries = sorted(bucket.entries, key=lambda e: e.created_at, reverse=True)
    return [
        SavingsEntryOut(
            id=e.id,
            amount=float(e.amount),
            note=e.note,
            created_at=e.created_at,
            period_label=e.period.label if e.period else None,
        )
        for e in entries
    ]


@router.patch("/buckets/{bucket_id}", response_model=SavingsBucketOut)
def update_bucket(
    bucket_id: int,
    payload: SavingsBucketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bucket = _get_bucket_or_404(db, bucket_id, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(bucket, field, value)
    db.commit()
    db.refresh(bucket)
    return _bucket_out(bucket)


@router.post("/buckets/{bucket_id}/balance", response_model=SavingsBucketOut)
def add_to_bucket_balance(
    bucket_id: int,
    payload: AddToBucketBalance,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Directly add to (or subtract from, with a negative amount) a bucket's saved
    total -- not tied to any pay period. For declaring an existing balance or
    correcting one, outside the normal per-period contribution flow."""
    bucket = _get_bucket_or_404(db, bucket_id, current_user.id)
    db.add(SavingsEntry(bucket_id=bucket.id, period_id=None, amount=payload.amount, note=payload.note))
    db.commit()
    db.refresh(bucket)
    return _bucket_out(bucket)


@router.post("/entries")
def add_savings_entry(
    payload: SavingsEntryIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    bucket = db.query(SavingsBucket).filter_by(id=payload.bucket_id, user_id=current_user.id).one_or_none()
    if bucket is None:
        raise HTTPException(status_code=404, detail=f"No such savings bucket: {payload.bucket_id}")
    period = db.query(PayPeriod).filter_by(id=payload.period_id, user_id=current_user.id).one_or_none()
    if period is None:
        raise HTTPException(status_code=404, detail=f"No such period: {payload.period_id}")
    entry = SavingsEntry(bucket_id=payload.bucket_id, period_id=payload.period_id, amount=payload.amount)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "bucket_id": entry.bucket_id, "period_id": entry.period_id, "amount": float(entry.amount)}


def _get_entry_or_404(db: Session, entry_id: int, user_id: int) -> SavingsEntry:
    entry = (
        db.query(SavingsEntry)
        .join(SavingsBucket)
        .filter(SavingsEntry.id == entry_id, SavingsBucket.user_id == user_id)
        .one_or_none()
    )
    if entry is None:
        raise HTTPException(status_code=404, detail=f"No such savings entry: {entry_id}")
    return entry


@router.delete("/entries/{entry_id}")
def delete_savings_entry(
    entry_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Remove a savings deposit added by mistake or duplicated -- e.g. adding the
    same amount to a bucket twice without realizing one was already there."""
    entry = _get_entry_or_404(db, entry_id, current_user.id)
    db.delete(entry)
    db.commit()
    return {"deleted": True}
