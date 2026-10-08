import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    BillSource,
    IncomeSource,
    SharedAccess,
    SharedAccessBill,
    SharedAccessIncome,
    User,
)
from app.schemas import (
    AddSplitPartner,
    SharedAccessCreate,
    SharedAccessOut,
    SharedAccessUpdate,
    SharedSourceRef,
    SharedWithMeOut,
    SplitBillOut,
    SplitPartner,
)
from app.services.period_service import compute_shared_view, detach_reimbursement_bills, split_count_for_bill

router = APIRouter(prefix="/sharing", tags=["sharing"])

_USER_NUMBER_RE = re.compile(r"\d{7}")


def _resolve_identifier(db: Session, raw: str) -> str:
    """Accepts either an email or someone's 7-digit account number and
    returns the email to store -- sharing stays keyed by email under the
    hood (so it still works before the other person has even signed up),
    the ID is just a friendlier way to type it in when they already have an
    account and would rather not hand out their email."""
    raw = raw.strip()
    if _USER_NUMBER_RE.fullmatch(raw):
        user = db.query(User).filter_by(user_number=raw).one_or_none()
        if user is None:
            raise HTTPException(status_code=404, detail=f"No account found with ID {raw}")
        return user.email
    return raw.lower()


def _name_for_email(db: Session, email: str) -> Optional[str]:
    user = db.query(User).filter_by(email=email).one_or_none()
    return user.name if user else None


def _shared_access_out(db: Session, shared: SharedAccess) -> SharedAccessOut:
    return SharedAccessOut(
        id=shared.id,
        viewer_email=shared.viewer_email,
        viewer_name=_name_for_email(db, shared.viewer_email),
        label=shared.label,
        bills=[
            SharedSourceRef(
                id=sb.bill_source_id,
                name=sb.bill_source.name,
                category=sb.bill_source.category,
                split_shared=sb.bill_source.split_shared,
            )
            for sb in shared.shared_bills
        ],
        income=[
            SharedSourceRef(id=si.income_source_id, name=si.income_source.name) for si in shared.shared_income
        ],
    )


def _validate_source_ids(
    db: Session, user_id: int, bill_source_ids: list[int], income_source_ids: list[int]
) -> None:
    """Only allow sharing sources the current user actually owns -- otherwise
    someone could pass an arbitrary ID and leak another account's bill."""
    if bill_source_ids:
        owned = {
            s.id
            for s in db.query(BillSource.id).filter(BillSource.user_id == user_id, BillSource.id.in_(bill_source_ids)).all()
        }
        missing = set(bill_source_ids) - owned
        if missing:
            raise HTTPException(status_code=400, detail=f"Not your bill(s): {sorted(missing)}")
    if income_source_ids:
        owned = {
            s.id
            for s in db.query(IncomeSource.id)
            .filter(IncomeSource.user_id == user_id, IncomeSource.id.in_(income_source_ids))
            .all()
        }
        missing = set(income_source_ids) - owned
        if missing:
            raise HTTPException(status_code=400, detail=f"Not your income source(s): {sorted(missing)}")


@router.get("", response_model=list[SharedAccessOut])
def list_shared_access(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """People I've shared access with."""
    shares = db.query(SharedAccess).filter_by(owner_id=current_user.id).all()
    return [_shared_access_out(db, s) for s in shares]


@router.post("", response_model=SharedAccessOut)
def create_shared_access(
    payload: SharedAccessCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    viewer_email = _resolve_identifier(db, payload.viewer_email)
    if viewer_email == current_user.email.strip().lower():
        raise HTTPException(status_code=400, detail="You can't share with yourself.")
    _validate_source_ids(db, current_user.id, payload.bill_source_ids, payload.income_source_ids)

    shared = SharedAccess(owner_id=current_user.id, viewer_email=viewer_email, label=payload.label)
    db.add(shared)
    db.flush()
    for bid in payload.bill_source_ids:
        db.add(SharedAccessBill(shared_access_id=shared.id, bill_source_id=bid))
    for iid in payload.income_source_ids:
        db.add(SharedAccessIncome(shared_access_id=shared.id, income_source_id=iid))
    db.commit()
    db.refresh(shared)
    return _shared_access_out(db, shared)


def _get_shared_access_or_404(db: Session, shared_id: int, owner_id: int) -> SharedAccess:
    shared = db.query(SharedAccess).filter_by(id=shared_id, owner_id=owner_id).one_or_none()
    if shared is None:
        raise HTTPException(status_code=404, detail=f"No such shared relationship: {shared_id}")
    return shared


@router.patch("/{shared_id}", response_model=SharedAccessOut)
def update_shared_access(
    shared_id: int,
    payload: SharedAccessUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    shared = _get_shared_access_or_404(db, shared_id, current_user.id)

    if payload.label is not None:
        shared.label = payload.label

    if payload.bill_source_ids is not None:
        _validate_source_ids(db, current_user.id, payload.bill_source_ids, [])
        # Only touch links that actually changed: keeping an unchanged bill's
        # SharedAccessBill row keeps the viewer's reimbursement bill attached
        # to it instead of replacing it with a fresh one on every edit.
        wanted = set(payload.bill_source_ids)
        existing = db.query(SharedAccessBill).filter_by(shared_access_id=shared.id).all()
        removed = [sab for sab in existing if sab.bill_source_id not in wanted]
        detach_reimbursement_bills(db, [sab.id for sab in removed])
        for sab in removed:
            db.delete(sab)
        for bid in wanted - {sab.bill_source_id for sab in existing}:
            db.add(SharedAccessBill(shared_access_id=shared.id, bill_source_id=bid))

    if payload.income_source_ids is not None:
        _validate_source_ids(db, current_user.id, [], payload.income_source_ids)
        db.query(SharedAccessIncome).filter_by(shared_access_id=shared.id).delete()
        for iid in payload.income_source_ids:
            db.add(SharedAccessIncome(shared_access_id=shared.id, income_source_id=iid))

    db.commit()
    db.refresh(shared)
    return _shared_access_out(db, shared)


@router.delete("/{shared_id}")
def delete_shared_access(
    shared_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    shared = _get_shared_access_or_404(db, shared_id, current_user.id)
    detach_reimbursement_bills(db, [sab.id for sab in shared.shared_bills])
    db.delete(shared)
    db.commit()
    return {"deleted": True}


@router.get("/shared-with-me", response_model=list[SharedWithMeOut])
def shared_with_me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """What other people have shared with me -- matched purely by email, since
    there's no invite flow to accept."""
    shares = db.query(SharedAccess).filter_by(viewer_email=current_user.email.strip().lower()).all()
    return [compute_shared_view(db, s) for s in shares]


def _split_bill_out(db: Session, source: BillSource) -> SplitBillOut:
    partner_rows = (
        db.query(SharedAccess)
        .join(SharedAccessBill, SharedAccessBill.shared_access_id == SharedAccess.id)
        .filter(SharedAccess.owner_id == source.user_id, SharedAccessBill.bill_source_id == source.id)
        .all()
    )
    split_count = split_count_for_bill(db, source.user_id, source.id)
    return SplitBillOut(
        bill_source_id=source.id,
        name=source.name,
        category=source.category,
        target_amount=float(source.default_target_amount),
        split_count=split_count,
        split_amount=float(source.default_target_amount) / split_count,
        partners=[
            SplitPartner(
                shared_access_id=s.id,
                viewer_email=s.viewer_email,
                viewer_name=_name_for_email(db, s.viewer_email),
                label=s.label,
            )
            for s in partner_rows
        ],
    )


@router.get("/split-bills", response_model=list[SplitBillOut])
def list_split_bills(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every one of the owner's active bills marked to split, all in one
    place, with whoever it's currently split with -- so you don't have to
    dig through each person's relationship to see the full picture."""
    sources = db.query(BillSource).filter_by(user_id=current_user.id, active=True, split_shared=True).all()
    return [_split_bill_out(db, s) for s in sources]


def _get_owned_bill_source_or_404(db: Session, bill_source_id: int, user_id: int) -> BillSource:
    source = db.query(BillSource).filter_by(id=bill_source_id, user_id=user_id).one_or_none()
    if source is None:
        raise HTTPException(status_code=404, detail=f"No such bill: {bill_source_id}")
    return source


@router.post("/split-bills/{bill_source_id}/people", response_model=SplitBillOut)
def add_split_partner(
    bill_source_id: int,
    payload: AddSplitPartner,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add one specific person as a split partner on this bill -- reuses an
    existing relationship with that email if there is one (so their other
    shared bills/income are untouched), otherwise creates a bare one. Also
    turns on split_shared for the bill, since adding a partner only makes
    sense if the amount is meant to be divided."""
    source = _get_owned_bill_source_or_404(db, bill_source_id, current_user.id)
    viewer_email = _resolve_identifier(db, payload.viewer_email)
    if viewer_email == current_user.email.strip().lower():
        raise HTTPException(status_code=400, detail="You can't split a bill with yourself.")

    shared = db.query(SharedAccess).filter_by(owner_id=current_user.id, viewer_email=viewer_email).one_or_none()
    if shared is None:
        shared = SharedAccess(owner_id=current_user.id, viewer_email=viewer_email, label=payload.label)
        db.add(shared)
        db.flush()
    elif payload.label and not shared.label:
        shared.label = payload.label

    already_linked = (
        db.query(SharedAccessBill).filter_by(shared_access_id=shared.id, bill_source_id=bill_source_id).one_or_none()
    )
    if already_linked is None:
        db.add(SharedAccessBill(shared_access_id=shared.id, bill_source_id=bill_source_id))

    if not source.split_shared:
        source.split_shared = True

    db.commit()
    db.refresh(source)
    return _split_bill_out(db, source)


@router.delete("/split-bills/{bill_source_id}/people/{shared_access_id}", response_model=SplitBillOut)
def remove_split_partner(
    bill_source_id: int,
    shared_access_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Drop one person from this bill's split -- only removes this bill from
    their relationship, leaving any other bills/income still shared with
    them untouched."""
    source = _get_owned_bill_source_or_404(db, bill_source_id, current_user.id)
    shared = _get_shared_access_or_404(db, shared_access_id, current_user.id)
    links = db.query(SharedAccessBill).filter_by(shared_access_id=shared.id, bill_source_id=bill_source_id)
    detach_reimbursement_bills(db, [sab.id for sab in links])
    links.delete(synchronize_session=False)
    db.commit()
    db.refresh(source)
    return _split_bill_out(db, source)
