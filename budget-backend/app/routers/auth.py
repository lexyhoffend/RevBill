import datetime
import random

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.auth import (
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_SECONDS,
    create_session_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.legal import CURRENT_TERMS_VERSION
from app.models import (
    BillEntry,
    BillSource,
    Event,
    IncomeEntry,
    IncomeSource,
    PayPeriod,
    SavingsBucket,
    SavingsEntry,
    SharedAccess,
    SharedAccessBill,
    SharedAccessIncome,
    User,
)
from app.schemas import DeleteAccountIn, LoginIn, PayCycleModeIn, ProfileUpdate, SignupIn, UserOut
from app.services.events import log_event
from app.services.period_service import (
    PAYDAY_LAYOUT,
    detach_reimbursement_bills,
    ensure_upcoming_periods,
    reset_untouched_upcoming_periods,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def generate_unique_user_number(db: Session) -> str:
    """A 7-digit account number someone can hand out instead of their email --
    checked for uniqueness against existing rows rather than a DB constraint,
    since sqlite can't add a UNIQUE constraint via ALTER TABLE to a column on
    an already-existing table."""
    for _ in range(50):
        candidate = f"{random.randint(0, 9999999):07d}"
        if db.query(User).filter_by(user_number=candidate).one_or_none() is None:
            return candidate
    raise RuntimeError("Could not generate a unique user number")

# samesite="none" + secure=True is required for the cookie to travel between the
# frontend (localhost:3001) and backend (localhost:8001) -- different ports count
# as different origins to the browser. Chrome/modern browsers treat localhost as a
# secure context, so `secure` cookies do work here over plain http in practice.
_COOKIE_KWARGS = dict(httponly=True, samesite="none", secure=True, max_age=SESSION_MAX_AGE_SECONDS, path="/")


def _set_session_cookie(response: Response, user_id: int) -> None:
    token = create_session_token(user_id)
    response.set_cookie(SESSION_COOKIE_NAME, token, **_COOKIE_KWARGS)


@router.post("/signup", response_model=UserOut)
def signup(payload: SignupIn, response: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not payload.accepted_terms:
        raise HTTPException(
            status_code=400, detail="You must be 18 or older and agree to the Terms of Service and Privacy Policy"
        )
    if db.query(User).filter_by(email=email).one_or_none() is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        user_number=generate_unique_user_number(db),
        terms_accepted_at=datetime.datetime.utcnow(),
        terms_version=CURRENT_TERMS_VERSION,
        cycle_layout=PAYDAY_LAYOUT,
    )
    db.add(user)
    db.flush()
    log_event(db, user.id, "account_created")
    db.commit()
    db.refresh(user)

    _set_session_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserOut)
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter_by(email=email).one_or_none()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    _set_session_cookie(response, user.id)
    return user


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_upcoming_periods(db, current_user)
    return current_user


@router.patch("/me/profile", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    if payload.name is not None:
        current_user.name = payload.name.strip() or None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/accept-terms", response_model=UserOut)
def accept_terms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """One-time agreement for accounts that predate the current policies."""
    current_user.terms_accepted_at = datetime.datetime.utcnow()
    current_user.terms_version = CURRENT_TERMS_VERSION
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/delete")
def delete_account(
    payload: DeleteAccountIn,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently deletes the signed-in user and everything they own. Requires
    their password again so a left-open session can't wipe an account.

    Bulk deletes run child-first because Postgres enforces the foreign keys.
    Reimbursement bills that other people got from this user's splits are
    detached and deactivated rather than deleted -- the same way they
    deactivate when a split partner is removed -- so those people keep their
    own payment history."""
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect password")

    uid = current_user.id
    share_ids = [row.id for row in db.query(SharedAccess.id).filter_by(owner_id=uid)]
    period_ids = [row.id for row in db.query(PayPeriod.id).filter_by(user_id=uid)]
    bucket_ids = [row.id for row in db.query(SavingsBucket.id).filter_by(user_id=uid)]
    bill_source_ids = [row.id for row in db.query(BillSource.id).filter_by(user_id=uid)]
    income_source_ids = [row.id for row in db.query(IncomeSource.id).filter_by(user_id=uid)]

    if share_ids:
        sab_ids = [row.id for row in db.query(SharedAccessBill.id).filter(SharedAccessBill.shared_access_id.in_(share_ids))]
        detach_reimbursement_bills(db, sab_ids)
        db.query(SharedAccessBill).filter(SharedAccessBill.shared_access_id.in_(share_ids)).delete(synchronize_session=False)
        db.query(SharedAccessIncome).filter(SharedAccessIncome.shared_access_id.in_(share_ids)).delete(synchronize_session=False)
        db.query(SharedAccess).filter(SharedAccess.id.in_(share_ids)).delete(synchronize_session=False)

    if period_ids:
        db.query(IncomeEntry).filter(IncomeEntry.period_id.in_(period_ids)).delete(synchronize_session=False)
        db.query(BillEntry).filter(BillEntry.period_id.in_(period_ids)).delete(synchronize_session=False)
        db.query(SavingsEntry).filter(SavingsEntry.period_id.in_(period_ids)).delete(synchronize_session=False)
    if bucket_ids:
        db.query(SavingsEntry).filter(SavingsEntry.bucket_id.in_(bucket_ids)).delete(synchronize_session=False)
    if bill_source_ids:
        db.query(BillEntry).filter(BillEntry.bill_source_id.in_(bill_source_ids)).delete(synchronize_session=False)
    if income_source_ids:
        db.query(IncomeEntry).filter(IncomeEntry.income_source_id.in_(income_source_ids)).delete(synchronize_session=False)

    db.query(PayPeriod).filter_by(user_id=uid).delete(synchronize_session=False)
    db.query(SavingsBucket).filter_by(user_id=uid).delete(synchronize_session=False)
    db.query(BillSource).filter_by(user_id=uid).delete(synchronize_session=False)
    db.query(IncomeSource).filter_by(user_id=uid).delete(synchronize_session=False)
    db.query(Event).filter_by(user_id=uid).delete(synchronize_session=False)
    db.query(User).filter_by(id=uid).delete(synchronize_session=False)
    db.commit()

    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"deleted": True}


@router.patch("/me/pay-cycle", response_model=UserOut)
def set_pay_cycle_mode(
    payload: PayCycleModeIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Sets the schedule on first use, or updates it later if the user got it wrong
    (e.g. picked the wrong pay date). Editing clears out any not-yet-touched
    auto-generated periods so the corrected schedule regenerates cleanly -- periods
    with real activity on them are left alone."""
    if payload.mode == "monthly":
        if payload.anchor_day is None or not (1 <= payload.anchor_day <= 31):
            raise HTTPException(status_code=400, detail="Monthly mode requires a day of month between 1 and 31")
        current_user.pay_cycle_anchor_day = payload.anchor_day
        current_user.pay_cycle_anchor_day2 = None
        current_user.pay_cycle_anchor_date = None
    elif payload.mode == "semimonthly":
        days = (payload.anchor_day, payload.anchor_day2)
        if any(d is None or not (1 <= d <= 31) for d in days) or payload.anchor_day == payload.anchor_day2:
            raise HTTPException(status_code=400, detail="Semimonthly mode requires two different pay days between 1 and 31")
        current_user.pay_cycle_anchor_day, current_user.pay_cycle_anchor_day2 = sorted(days)
        current_user.pay_cycle_anchor_date = None
    elif payload.mode in ("weekly", "biweekly"):
        if payload.anchor_date is None:
            raise HTTPException(status_code=400, detail=f"{payload.mode.title()} mode requires a start date")
        current_user.pay_cycle_anchor_date = payload.anchor_date
        current_user.pay_cycle_anchor_day = None
        current_user.pay_cycle_anchor_day2 = None
    else:
        current_user.pay_cycle_anchor_day = None
        current_user.pay_cycle_anchor_day2 = None
        current_user.pay_cycle_anchor_date = None

    current_user.pay_cycle_mode = payload.mode
    db.commit()
    db.refresh(current_user)

    reset_untouched_upcoming_periods(db, current_user)
    ensure_upcoming_periods(db, current_user)
    db.refresh(current_user)
    return current_user
