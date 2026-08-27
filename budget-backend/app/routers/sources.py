from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import BillSource, IncomeSource, User
from app.schemas import (
    BillSourceIn,
    BillSourceOut,
    BillSourceUpdate,
    DeleteResult,
    IncomeSourceIn,
    IncomeSourceOut,
    IncomeSourceUpdate,
)
from app.services.period_service import (
    remove_untouched_entries_for_source,
    sync_bill_entries_for_source,
    sync_income_entries_for_source,
    sync_reimbursement_bills_for_viewer,
)

router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("/income", response_model=list[IncomeSourceOut])
def list_income_sources(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(IncomeSource).filter_by(user_id=current_user.id).all()


@router.post("/income", response_model=IncomeSourceOut)
def create_income_source(
    payload: IncomeSourceIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    source = IncomeSource(user_id=current_user.id, **payload.model_dump())
    db.add(source)
    db.commit()
    db.refresh(source)
    sync_income_entries_for_source(db, source)
    db.refresh(source)
    return source


def _get_income_source_or_404(db: Session, source_id: int, user_id: int) -> IncomeSource:
    source = db.query(IncomeSource).filter_by(id=source_id, user_id=user_id).one_or_none()
    if source is None:
        raise HTTPException(status_code=404, detail=f"No such income source: {source_id}")
    return source


@router.patch("/income/{source_id}", response_model=IncomeSourceOut)
def update_income_source(
    source_id: int,
    payload: IncomeSourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = _get_income_source_or_404(db, source_id, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(source, field, value)
    db.commit()
    db.refresh(source)
    sync_income_entries_for_source(db, source)
    db.refresh(source)
    return source


@router.delete("/income/{source_id}", response_model=DeleteResult)
def delete_income_source(
    source_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    source = _get_income_source_or_404(db, source_id, current_user.id)
    has_history = len(source.entries) > 0
    if has_history:
        # preserve historical period data -- deactivate instead of deleting so
        # it stops being copied into new periods but past entries stay intact
        source.active = False
        db.commit()
        return DeleteResult(deleted=False, deactivated=True)
    db.delete(source)
    db.commit()
    return DeleteResult(deleted=True, deactivated=False)


@router.get("/bills", response_model=list[BillSourceOut])
def list_bill_sources(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sync_reimbursement_bills_for_viewer(db, current_user)
    return db.query(BillSource).filter_by(user_id=current_user.id).all()


@router.post("/bills", response_model=BillSourceOut)
def create_bill_source(
    payload: BillSourceIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    source = BillSource(user_id=current_user.id, **payload.model_dump())
    db.add(source)
    db.commit()
    db.refresh(source)
    sync_bill_entries_for_source(db, source)
    db.refresh(source)
    return source


def _get_bill_source_or_404(db: Session, source_id: int, user_id: int) -> BillSource:
    source = db.query(BillSource).filter_by(id=source_id, user_id=user_id).one_or_none()
    if source is None:
        raise HTTPException(status_code=404, detail=f"No such bill source: {source_id}")
    return source


@router.patch("/bills/{source_id}", response_model=BillSourceOut)
def update_bill_source(
    source_id: int,
    payload: BillSourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = _get_bill_source_or_404(db, source_id, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(source, field, value)
    db.commit()
    db.refresh(source)
    sync_bill_entries_for_source(db, source)
    db.refresh(source)
    return source


@router.delete("/bills/{source_id}", response_model=DeleteResult)
def delete_bill_source(
    source_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    source = _get_bill_source_or_404(db, source_id, current_user.id)
    has_history = len(source.entries) > 0
    if has_history:
        source.active = False
        db.commit()
        remove_untouched_entries_for_source(db, source)
        return DeleteResult(deleted=False, deactivated=True)
    db.delete(source)
    db.commit()
    return DeleteResult(deleted=True, deactivated=False)
