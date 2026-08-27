import datetime
from typing import Literal, Optional

from pydantic import BaseModel

CadenceType = Literal["monthly_date", "weekly", "biweekly"]

# Account-level setting governing how Payment Cycles are created -- distinct from
# CadenceType above, which is per-income-source and only used to compute how many
# times a given income lands within an already-existing period's date range.
PayCycleMode = Literal["monthly", "biweekly", "weekly", "custom"]


class SignupIn(BaseModel):
    email: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    user_number: str
    name: Optional[str] = None
    pay_cycle_mode: Optional[PayCycleMode]
    pay_cycle_anchor_day: Optional[int]
    pay_cycle_anchor_date: Optional[datetime.date]

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    name: Optional[str] = None


class PayCycleModeIn(BaseModel):
    mode: PayCycleMode
    anchor_day: Optional[int] = None  # required for "monthly", 1-31
    anchor_date: Optional[datetime.date] = None  # required for "weekly"/"biweekly"


class IncomeSourceIn(BaseModel):
    name: str
    cadence_type: CadenceType
    cadence_day_of_month: Optional[int] = None  # 1-31, required when cadence_type=monthly_date
    cadence_weekday: Optional[int] = None  # 0=Mon..6=Sun, required when weekly/biweekly
    start_date: datetime.date
    amount: float = 0  # positive, per occurrence
    active: bool = True


class IncomeSourceOut(IncomeSourceIn):
    id: int

    model_config = {"from_attributes": True}


class IncomeSourceUpdate(BaseModel):
    name: Optional[str] = None
    cadence_type: Optional[CadenceType] = None
    cadence_day_of_month: Optional[int] = None
    cadence_weekday: Optional[int] = None
    start_date: Optional[datetime.date] = None
    amount: Optional[float] = None
    active: Optional[bool] = None


class BillSourceIn(BaseModel):
    name: str
    category: str = "Other"
    default_target_amount: float = 0
    is_revolving: bool = False
    active: bool = True
    credit_card_issuer: Optional[str] = None  # only meaningful when category="Credit Card"
    due_day: Optional[int] = None  # 1-31, day of month this bill is actually due
    split_shared: bool = False  # divide evenly across owner + everyone it's shared with


class BillSourceOut(BillSourceIn):
    id: int
    shared_access_bill_id: Optional[int] = None  # set only for an auto-provisioned reimbursement bill

    model_config = {"from_attributes": True}


class BillSourceUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    default_target_amount: Optional[float] = None
    is_revolving: Optional[bool] = None
    active: Optional[bool] = None
    credit_card_issuer: Optional[str] = None
    due_day: Optional[int] = None
    split_shared: Optional[bool] = None


class DeleteResult(BaseModel):
    deleted: bool  # true if actually removed, false if deactivated instead (had history)
    deactivated: bool


class PayPeriodCreate(BaseModel):
    label: str
    start_date: datetime.date
    end_date: datetime.date


class IncomeEntryOut(BaseModel):
    id: int
    income_source_id: Optional[int]
    source_name: str  # source.name, or custom_label for one-time income
    is_one_time: bool
    expected_amount: float
    actual_amount: float
    is_received: bool

    model_config = {"from_attributes": True}


class IncomeEntryUpdate(BaseModel):
    expected_amount: Optional[float] = None
    actual_amount: Optional[float] = None
    is_received: Optional[bool] = None


class OneTimeIncomeCreate(BaseModel):
    label: str
    amount: float  # positive; treated as already received (actual = amount)


class BillEntryOut(BaseModel):
    id: int
    bill_source_id: int
    source_name: str
    category: str
    is_revolving: bool
    target_amount: float
    actual_amount: float
    is_paid: bool
    owed_balance: float  # computed: carried-forward owed balance as of this period, revolving bills only
    due_date: Optional[datetime.date] = None  # this bill's due_day mapped onto this specific period, if it lands here
    due_day: Optional[int] = None  # the bill's standing due-day-of-month (1-31), shown even when due_date doesn't
    is_overdue: bool = False  # true only if due_date has passed AND isn't satisfied by a payment in any cycle
    split_shared: bool = False
    split_count: int = 1  # owner + everyone this bill is shared with, only meaningful when split_shared
    split_amount: float = 0  # target_amount / split_count -- what each person (including the owner) owes

    model_config = {"from_attributes": True}


class BillEntryUpdate(BaseModel):
    target_amount: Optional[float] = None
    actual_amount: Optional[float] = None
    is_paid: Optional[bool] = None


class PayPeriodOut(BaseModel):
    id: int
    label: str
    start_date: datetime.date
    end_date: datetime.date

    model_config = {"from_attributes": True}


class PayPeriodSummary(BaseModel):
    id: int
    label: str
    start_date: datetime.date
    end_date: datetime.date
    total_income: float
    total_bills_paid: float
    total_saved: float
    left_over: float


class PeriodSavingsEntryOut(BaseModel):
    id: int
    bucket_id: int
    bucket_name: str
    amount: float

    model_config = {"from_attributes": True}


class PayPeriodDetail(BaseModel):
    id: int
    label: str
    start_date: datetime.date
    end_date: datetime.date
    income_entries: list[IncomeEntryOut]
    bill_entries: list[BillEntryOut]
    savings_entries: list[PeriodSavingsEntryOut]
    total_income: float
    total_bills_paid: float
    total_saved: float
    left_over: float  # income - bills paid - saved this period


class SavingsBucketIn(BaseModel):
    name: str
    goal_amount: Optional[float] = None
    starting_balance: float = 0  # "I already have $X saved toward this" -- seeds an initial entry


class SavingsBucketUpdate(BaseModel):
    name: Optional[str] = None
    goal_amount: Optional[float] = None


class SavingsBucketOut(BaseModel):
    id: int
    name: str
    goal_amount: Optional[float]
    total_saved: float
    percent_complete: Optional[float]  # total_saved / goal_amount * 100; null if no goal set

    model_config = {"from_attributes": True}


class SavingsEntryIn(BaseModel):
    bucket_id: int
    period_id: int
    amount: float


class AddToBucketBalance(BaseModel):
    amount: float
    note: Optional[str] = None


class PeriodSavingsEntryCreate(BaseModel):
    bucket_id: int
    amount: float


class SavingsEntryOut(BaseModel):
    id: int
    amount: float
    note: Optional[str]
    created_at: datetime.datetime
    period_label: Optional[str]  # the Payment Cycle this contribution came from, if any

    model_config = {"from_attributes": True}


class BillDueSoon(BaseModel):
    bill_source_id: int
    name: str
    category: str
    amount_due: float
    period_label: str
    due_date: datetime.date  # the bill's actual due_day if set, else the cycle's pay date
    is_overdue: bool


class BillCalendarEntry(BaseModel):
    date: datetime.date  # a real occurrence of this bill's due_day -- never a fake fallback
    bill_source_id: int
    name: str
    category: str
    amount: float
    is_paid: bool  # already handled -- your "paid" checkbox, or paid (possibly early) elsewhere
    is_overdue: bool
    period_id: int
    period_label: str


class CategoryProjection(BaseModel):
    category: str
    monthly: float  # actually paid, summed across cycles whose pay date falls in the current month
    annual: float  # actually paid, summed across cycles whose pay date falls in the current year


class CardOwed(BaseModel):
    bill_source_id: int
    name: str
    issuer: Optional[str]
    owed_balance: float
    projected_payoff_date: Optional[datetime.date] = None


class DashboardSummary(BaseModel):
    current_period_id: Optional[int]
    current_period_label: Optional[str]
    current_total_income: float
    current_total_bills_paid: float
    current_total_saved: float
    current_left_over: float

    total_owed: float
    cards_owed: list[CardOwed]
    bills_due_soon: list[BillDueSoon]

    total_saved_all_buckets: float
    total_savings_goal: Optional[float]

    bill_categories: list[CategoryProjection]
    monthly_bills_total: float
    annual_bills_total: float

    income_sources: list[CategoryProjection]
    monthly_income_total: float
    annual_income_total: float

    monthly_income_estimate: Optional[float]
    bills_percent_of_income: Optional[float]


class SharedSourceRef(BaseModel):
    """A bill or income source as it appears in the sharing-configuration UI --
    just enough to label a checkbox, not the full source record."""

    id: int
    name: str
    category: Optional[str] = None  # bills only
    split_shared: bool = False  # bills only


class SharedAccessCreate(BaseModel):
    viewer_email: str
    label: Optional[str] = None
    bill_source_ids: list[int] = []
    income_source_ids: list[int] = []


class SharedAccessUpdate(BaseModel):
    label: Optional[str] = None
    bill_source_ids: Optional[list[int]] = None
    income_source_ids: Optional[list[int]] = None


class SharedAccessOut(BaseModel):
    id: int
    viewer_email: str
    viewer_name: Optional[str] = None  # the viewer's own display name, if they've set one and have an account
    label: Optional[str] = None
    bills: list[SharedSourceRef]
    income: list[SharedSourceRef]


class SharedBillStatus(BaseModel):
    """A shared bill's status in the owner's current cycle -- read-only, same
    shape of information as BillEntryOut but pared down for an outside viewer."""

    bill_source_id: int
    name: str
    category: str
    target_amount: float
    actual_amount: float
    is_paid: bool
    due_date: Optional[datetime.date] = None
    is_overdue: bool = False
    split_shared: bool = False
    split_count: int = 1
    split_amount: float = 0  # this viewer's own share -- target_amount / split_count


class SharedIncomeStatus(BaseModel):
    income_source_id: int
    name: str
    expected_amount: float
    actual_amount: float
    is_received: bool


class SplitPartner(BaseModel):
    shared_access_id: int
    viewer_email: str
    viewer_name: Optional[str] = None
    label: Optional[str] = None


class SplitBillOut(BaseModel):
    """One of the owner's bills that's marked to split, plus everyone it's
    currently split with -- the consolidated view for the 'Split bills' tab,
    so a bill's split partners can be managed right where the bill lives
    instead of hunting through each person's relationship separately."""

    bill_source_id: int
    name: str
    category: str
    target_amount: float
    split_count: int  # owner + partners
    split_amount: float
    partners: list[SplitPartner]


class AddSplitPartner(BaseModel):
    viewer_email: str
    label: Optional[str] = None


class SharedWithMeOut(BaseModel):
    shared_access_id: int
    owner_email: str
    owner_name: Optional[str] = None
    label: Optional[str] = None
    current_period_label: Optional[str] = None
    bills: list[SharedBillStatus]
    income: list[SharedIncomeStatus]
