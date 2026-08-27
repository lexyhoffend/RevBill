const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8001";

export type CadenceType = "monthly_date" | "weekly" | "biweekly";

// Account-level setting governing how Payment Cycles are created -- distinct from
// CadenceType above, which is per-income-source.
export type PayCycleMode = "monthly" | "biweekly" | "weekly" | "custom";

export const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const BILL_CATEGORIES = [
  "Energy",
  "Water",
  "Garbage/Trash",
  "Internet",
  "Cell Phone",
  "Cable/TV",
  "Rent",
  "Mortgage",
  "Car Payment",
  "Insurance",
  "Security System",
  "Subscription",
  "Gym",
  "Loan",
  "Student Loan",
  "Credit Card",
  "Other",
];

// Groups the picklist categories above into the 6 buckets shown in the "This
// cycle" breakdown -- e.g. Energy/Water/Internet all roll up into "Utilities".
export const BILL_CATEGORY_GROUPS: Record<string, string> = {
  Energy: "Utilities",
  Water: "Utilities",
  "Garbage/Trash": "Utilities",
  Internet: "Utilities",
  "Cell Phone": "Utilities",
  "Cable/TV": "Utilities",
  Rent: "Rent",
  Mortgage: "Mortgage",
  Loan: "Loans",
  "Student Loan": "Loans",
  "Credit Card": "Credit Card",
  "Car Payment": "Other bills",
  Insurance: "Other bills",
  "Security System": "Other bills",
  Subscription: "Other bills",
  Gym: "Other bills",
  Other: "Other bills",
};

export const BILL_GROUP_ORDER = ["Utilities", "Credit Card", "Rent", "Mortgage", "Loans", "Other bills"];

// Dependent picklist, only shown when category === "Credit Card" -- so multiple
// cards can be tracked individually while still rolling up into one category.
export const CREDIT_CARD_ISSUERS = [
  "American Express",
  "Chase",
  "Capital One",
  "Citi",
  "Discover",
  "Bank of America",
  "Wells Fargo",
  "U.S. Bank",
  "Barclays",
  "Synchrony",
  "Apple Card",
  "Store Card",
  "Other",
];

export type IncomeSource = {
  id: number;
  name: string;
  cadence_type: CadenceType;
  cadence_day_of_month: number | null;
  cadence_weekday: number | null;
  start_date: string;
  amount: number;
  active: boolean;
};

export type BillSource = {
  id: number;
  name: string;
  category: string;
  default_target_amount: number;
  is_revolving: boolean;
  active: boolean;
  credit_card_issuer: string | null;
  due_day: number | null;
  split_shared: boolean;
  shared_access_bill_id: number | null;
};

export type PayPeriod = {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
};

export type IncomeEntry = {
  id: number;
  income_source_id: number | null;
  source_name: string;
  is_one_time: boolean;
  expected_amount: number;
  actual_amount: number;
  is_received: boolean;
};

export type BillEntry = {
  id: number;
  bill_source_id: number;
  source_name: string;
  category: string;
  is_revolving: boolean;
  target_amount: number;
  actual_amount: number;
  is_paid: boolean;
  owed_balance: number;
  due_date: string | null;
  due_day: number | null;
  is_overdue: boolean;
  split_shared: boolean;
  split_count: number;
  split_amount: number;
};

export type PeriodSavingsEntry = {
  id: number;
  bucket_id: number;
  bucket_name: string;
  amount: number;
};

export type PayPeriodDetail = PayPeriod & {
  income_entries: IncomeEntry[];
  bill_entries: BillEntry[];
  savings_entries: PeriodSavingsEntry[];
  total_income: number;
  total_bills_paid: number;
  total_saved: number;
  left_over: number;
};

export type PayPeriodSummary = PayPeriod & {
  total_income: number;
  total_bills_paid: number;
  total_saved: number;
  left_over: number;
};

export type DeleteResult = {
  deleted: boolean;
  deactivated: boolean;
};

export type SavingsEntry = {
  id: number;
  amount: number;
  note: string | null;
  created_at: string;
  period_label: string | null;
};

export type SavingsBucket = {
  id: number;
  name: string;
  goal_amount: number | null;
  total_saved: number;
  percent_complete: number | null;
};

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include", // send/receive the session cookie across the :3001 <-> :8001 origins
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    let detail: string | undefined;
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed.detail === "string") detail = parsed.detail;
    } catch {
      // body wasn't JSON -- fall through to the raw form below
    }
    throw new Error(detail ?? `${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

export type User = {
  id: number;
  email: string;
  user_number: string;
  name: string | null;
  pay_cycle_mode: PayCycleMode | null;
  pay_cycle_anchor_day: number | null;
  pay_cycle_anchor_date: string | null;
};

export const signup = (email: string, password: string) =>
  jsonFetch<User>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) });
export const login = (email: string, password: string) =>
  jsonFetch<User>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const setPayCycleMode = (data: { mode: PayCycleMode; anchor_day?: number | null; anchor_date?: string | null }) =>
  jsonFetch<User>("/auth/me/pay-cycle", { method: "PATCH", body: JSON.stringify(data) });
export const logout = () => jsonFetch("/auth/logout", { method: "POST" });
export const getMe = () => jsonFetch<User>("/auth/me");
export const updateProfile = (data: { name: string | null }) =>
  jsonFetch<User>("/auth/me/profile", { method: "PATCH", body: JSON.stringify(data) });

export type IncomeSourceCreate = {
  name: string;
  cadence_type: CadenceType;
  cadence_day_of_month?: number | null;
  cadence_weekday?: number | null;
  start_date: string;
  amount: number;
};

export const listIncomeSources = () => jsonFetch<IncomeSource[]>("/sources/income");
export const createIncomeSource = (data: IncomeSourceCreate) =>
  jsonFetch<IncomeSource>("/sources/income", { method: "POST", body: JSON.stringify(data) });
export const updateIncomeSource = (id: number, data: Partial<IncomeSourceCreate> & { active?: boolean }) =>
  jsonFetch<IncomeSource>(`/sources/income/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteIncomeSource = (id: number) =>
  jsonFetch<DeleteResult>(`/sources/income/${id}`, { method: "DELETE" });

export type BillSourceCreate = {
  name: string;
  category: string;
  default_target_amount: number;
  is_revolving: boolean;
  credit_card_issuer?: string | null;
  due_day?: number | null;
  split_shared?: boolean;
};

export const listBillSources = () => jsonFetch<BillSource[]>("/sources/bills");
export const createBillSource = (data: BillSourceCreate) =>
  jsonFetch<BillSource>("/sources/bills", { method: "POST", body: JSON.stringify(data) });
export const updateBillSource = (id: number, data: Partial<BillSourceCreate> & { active?: boolean }) =>
  jsonFetch<BillSource>(`/sources/bills/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteBillSource = (id: number) =>
  jsonFetch<DeleteResult>(`/sources/bills/${id}`, { method: "DELETE" });

export const listPeriods = () => jsonFetch<PayPeriod[]>("/periods");
export const listPeriodsSummary = () => jsonFetch<PayPeriodSummary[]>("/periods/summary");
export const createPeriod = (data: { label: string; start_date: string; end_date: string }) =>
  jsonFetch<PayPeriod>("/periods", { method: "POST", body: JSON.stringify(data) });
export const getPeriod = (id: number) => jsonFetch<PayPeriodDetail>(`/periods/${id}`);
export const deletePeriod = (id: number) => jsonFetch<{ deleted: boolean }>(`/periods/${id}`, { method: "DELETE" });
export const generateNextPeriod = () => jsonFetch<PayPeriod>("/periods/generate-next", { method: "POST" });

export type BillCalendarEntry = {
  date: string;
  bill_source_id: number;
  name: string;
  category: string;
  amount: number;
  is_paid: boolean;
  is_overdue: boolean;
  period_id: number;
  period_label: string;
};

export const getBillCalendar = () => jsonFetch<BillCalendarEntry[]>("/periods/calendar");

export type BillDueSoon = {
  bill_source_id: number;
  name: string;
  category: string;
  amount_due: number;
  period_label: string;
  due_date: string;
  is_overdue: boolean;
};

export type CategoryProjection = {
  category: string;
  monthly: number;
  annual: number;
};

export type CardOwed = {
  bill_source_id: number;
  name: string;
  issuer: string | null;
  owed_balance: number;
  projected_payoff_date: string | null;
};

export type DashboardSummary = {
  current_period_id: number | null;
  current_period_label: string | null;
  current_total_income: number;
  current_total_bills_paid: number;
  current_total_saved: number;
  current_left_over: number;
  total_owed: number;
  cards_owed: CardOwed[];
  bills_due_soon: BillDueSoon[];
  total_saved_all_buckets: number;
  total_savings_goal: number | null;
  bill_categories: CategoryProjection[];
  monthly_bills_total: number;
  annual_bills_total: number;
  income_sources: CategoryProjection[];
  monthly_income_total: number;
  annual_income_total: number;
  monthly_income_estimate: number | null;
  bills_percent_of_income: number | null;
};

export const getDashboardSummary = () => jsonFetch<DashboardSummary>("/periods/dashboard-summary");

export const addOneTimeIncome = (periodId: number, data: { label: string; amount: number }) =>
  jsonFetch<IncomeEntry>(`/periods/${periodId}/income-entries`, { method: "POST", body: JSON.stringify(data) });

export const updateIncomeEntry = (
  id: number,
  data: { actual_amount?: number; expected_amount?: number; is_received?: boolean }
) => jsonFetch<IncomeEntry>(`/periods/income-entries/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const updateBillEntry = (
  id: number,
  data: { actual_amount?: number; target_amount?: number; is_paid?: boolean }
) => jsonFetch<BillEntry>(`/periods/bill-entries/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const listSavingsBuckets = () => jsonFetch<SavingsBucket[]>("/savings/buckets");
export const createSavingsBucket = (data: { name: string; goal_amount?: number | null; starting_balance?: number }) =>
  jsonFetch<SavingsBucket>("/savings/buckets", { method: "POST", body: JSON.stringify(data) });
export const updateSavingsBucket = (id: number, data: { name?: string; goal_amount?: number | null }) =>
  jsonFetch<SavingsBucket>(`/savings/buckets/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const addToBucketBalance = (id: number, data: { amount: number; note?: string }) =>
  jsonFetch<SavingsBucket>(`/savings/buckets/${id}/balance`, { method: "POST", body: JSON.stringify(data) });
export const getBucketEntries = (id: number) => jsonFetch<SavingsEntry[]>(`/savings/buckets/${id}/entries`);
export const addSavingsEntry = (data: { bucket_id: number; period_id: number; amount: number }) =>
  jsonFetch("/savings/entries", { method: "POST", body: JSON.stringify(data) });
export const deleteSavingsEntry = (id: number) =>
  jsonFetch<{ deleted: boolean }>(`/savings/entries/${id}`, { method: "DELETE" });

export const addPeriodSavingsEntry = (periodId: number, data: { bucket_id: number; amount: number }) =>
  jsonFetch<PeriodSavingsEntry>(`/periods/${periodId}/savings-entries`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export type SharedSourceRef = {
  id: number;
  name: string;
  category: string | null;
  split_shared: boolean;
};

export type SharedAccess = {
  id: number;
  viewer_email: string;
  viewer_name: string | null;
  label: string | null;
  bills: SharedSourceRef[];
  income: SharedSourceRef[];
};

export type SharedBillStatus = {
  bill_source_id: number;
  name: string;
  category: string;
  target_amount: number;
  actual_amount: number;
  is_paid: boolean;
  due_date: string | null;
  is_overdue: boolean;
  split_shared: boolean;
  split_count: number;
  split_amount: number;
};

export type SharedIncomeStatus = {
  income_source_id: number;
  name: string;
  expected_amount: number;
  actual_amount: number;
  is_received: boolean;
};

export type SharedWithMe = {
  shared_access_id: number;
  owner_email: string;
  owner_name: string | null;
  label: string | null;
  current_period_label: string | null;
  bills: SharedBillStatus[];
  income: SharedIncomeStatus[];
};

export const listSharedAccess = () => jsonFetch<SharedAccess[]>("/sharing");
export const createSharedAccess = (data: {
  viewer_email: string;
  label?: string | null;
  bill_source_ids: number[];
  income_source_ids: number[];
}) => jsonFetch<SharedAccess>("/sharing", { method: "POST", body: JSON.stringify(data) });
export const updateSharedAccess = (
  id: number,
  data: { label?: string | null; bill_source_ids?: number[]; income_source_ids?: number[] }
) => jsonFetch<SharedAccess>(`/sharing/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteSharedAccess = (id: number) =>
  jsonFetch<{ deleted: boolean }>(`/sharing/${id}`, { method: "DELETE" });
export const listSharedWithMe = () => jsonFetch<SharedWithMe[]>("/sharing/shared-with-me");

export type SplitPartner = {
  shared_access_id: number;
  viewer_email: string;
  viewer_name: string | null;
  label: string | null;
};

export type SplitBill = {
  bill_source_id: number;
  name: string;
  category: string;
  target_amount: number;
  split_count: number;
  split_amount: number;
  partners: SplitPartner[];
};

export const listSplitBills = () => jsonFetch<SplitBill[]>("/sharing/split-bills");
export const addSplitPartner = (billSourceId: number, data: { viewer_email: string; label?: string | null }) =>
  jsonFetch<SplitBill>(`/sharing/split-bills/${billSourceId}/people`, { method: "POST", body: JSON.stringify(data) });
export const removeSplitPartner = (billSourceId: number, sharedAccessId: number) =>
  jsonFetch<SplitBill>(`/sharing/split-bills/${billSourceId}/people/${sharedAccessId}`, { method: "DELETE" });
