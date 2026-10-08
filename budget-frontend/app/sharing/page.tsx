"use client";

import { useEffect, useState } from "react";
import {
  BillSource,
  IncomeSource,
  SharedAccess,
  SharedWithMe,
  SplitBill,
  SplitPartner,
  addSplitPartner,
  createSharedAccess,
  deleteSharedAccess,
  listBillSources,
  listIncomeSources,
  listSharedAccess,
  listSharedWithMe,
  listSplitBills,
  removeSplitPartner,
  updateBillSource,
  updateSharedAccess,
} from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";
import RequirePayCycle from "@/components/RequirePayCycle";
import DashboardHeader from "@/components/DashboardHeader";
import InfoTooltip from "@/components/InfoTooltip";
import BillCategoryIcon from "@/components/BillCategoryIcon";
import { useConfirm } from "@/components/ConfirmProvider";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function personLabel(label: string | null, name: string | null, email: string): string {
  return label || name || email;
}

function SourceCheckboxes({
  bills,
  income,
  selectedBillIds,
  selectedIncomeIds,
  onToggleBill,
  onToggleIncome,
}: {
  bills: BillSource[];
  income: IncomeSource[];
  selectedBillIds: Set<number>;
  selectedIncomeIds: Set<number>;
  onToggleBill: (id: number) => void;
  onToggleIncome: (id: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bills</div>
        {bills.length === 0 && <p className="text-xs text-slate-400">No bills set up yet.</p>}
        {bills.map((b) => (
          <label key={b.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedBillIds.has(b.id)}
              onChange={() => onToggleBill(b.id)}
              className="w-4 h-4 accent-sky-700"
            />
            <BillCategoryIcon category={b.category} className="w-4 h-4 shrink-0" />
            {b.name}
            {b.split_shared && <span className="text-xs text-sky-700 dark:text-sky-400">(splits evenly)</span>}
          </label>
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Income</div>
        {income.length === 0 && <p className="text-xs text-slate-400">No income set up yet.</p>}
        {income.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedIncomeIds.has(s.id)}
              onChange={() => onToggleIncome(s.id)}
              className="w-4 h-4 accent-sky-700"
            />
            {s.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function EditRelationship({
  shared,
  bills,
  income,
  onSaved,
  onCancel,
}: {
  shared: SharedAccess;
  bills: BillSource[];
  income: IncomeSource[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(shared.label ?? "");
  const [billIds, setBillIds] = useState(new Set(shared.bills.map((b) => b.id)));
  const [incomeIds, setIncomeIds] = useState(new Set(shared.income.map((s) => s.id)));
  const [saving, setSaving] = useState(false);

  function toggleBill(id: number) {
    setBillIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleIncome(id: number) {
    setIncomeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await updateSharedAccess(shared.id, {
        label: label || null,
        bill_source_ids: Array.from(billIds),
        income_source_ids: Array.from(incomeIds),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-sky-300 dark:border-sky-700 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">Editing relationship with</span>
        <span className="text-sm font-medium">{personLabel(null, shared.viewer_name, shared.viewer_email)}</span>
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Name for this person (optional), e.g. Mom"
        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
      />
      <SourceCheckboxes
        bills={bills}
        income={income}
        selectedBillIds={billIds}
        selectedIncomeIds={incomeIds}
        onToggleBill={toggleBill}
        onToggleIncome={toggleIncome}
      />
      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button onClick={onCancel} className="text-sm text-slate-400">
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddRelationship({
  bills,
  income,
  onAdded,
}: {
  bills: BillSource[];
  income: IncomeSource[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [billIds, setBillIds] = useState(new Set<number>());
  const [incomeIds, setIncomeIds] = useState(new Set<number>());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleBill(id: number) {
    setBillIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleIncome(id: number) {
    setIncomeIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSaving(true);
    setError(null);
    try {
      await createSharedAccess({
        viewer_email: email,
        label: label || null,
        bill_source_ids: Array.from(billIds),
        income_source_ids: Array.from(incomeIds),
      });
      setEmail("");
      setLabel("");
      setBillIds(new Set());
      setIncomeIds(new Set());
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-sky-700 dark:text-sky-400 hover:underline">
        + Add person
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-sky-200 dark:border-sky-800 p-4 space-y-3 bg-sky-50/40 dark:bg-sky-950/20">
      <div className="text-sm font-medium text-sky-700 dark:text-sky-400">Add a person</div>
      {error && <p className="text-amber-700 text-sm">{error}</p>}
      <div className="flex gap-2 flex-wrap">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="text"
          required
          placeholder="Their email or 7-digit ID"
          className="flex-1 min-w-48 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name (optional), e.g. Mom"
          className="flex-1 min-w-40 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
        />
      </div>
      <p className="text-xs text-slate-400">
        Choose what they can see -- only the bills and income you check below, nothing else.
      </p>
      <SourceCheckboxes
        bills={bills}
        income={income}
        selectedBillIds={billIds}
        selectedIncomeIds={incomeIds}
        onToggleBill={toggleBill}
        onToggleIncome={toggleIncome}
      />
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Adding…" : "Add person"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-400">
          Cancel
        </button>
      </div>
    </form>
  );
}

function OutgoingShares() {
  const { confirm } = useConfirm();
  const [shares, setShares] = useState<SharedAccess[]>([]);
  const [bills, setBills] = useState<BillSource[]>([]);
  const [income, setIncome] = useState<IncomeSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  function refresh() {
    listSharedAccess().then(setShares).catch((e) => setError(String(e)));
  }

  useEffect(() => {
    refresh();
    listBillSources()
      .then((all) => setBills(all.filter((b) => b.active)))
      .catch((e) => setError(String(e)));
    listIncomeSources()
      .then((all) => setIncome(all.filter((s) => s.active)))
      .catch((e) => setError(String(e)));
  }, []);

  async function remove(shared: SharedAccess) {
    const ok = await confirm(
      `Stop sharing with ${personLabel(shared.label, shared.viewer_name, shared.viewer_email)}?`,
      { destructive: true }
    );
    if (!ok) return;
    await deleteSharedAccess(shared.id);
    refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-amber-700 text-sm">{error}</p>}

      {shares.length === 0 && <p className="text-sm text-slate-400">You haven't shared with anyone yet.</p>}

      {shares.map((shared) =>
        editingId === shared.id ? (
          <EditRelationship
            key={shared.id}
            shared={shared}
            bills={bills}
            income={income}
            onCancel={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null);
              refresh();
            }}
          />
        ) : (
          <div key={shared.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{personLabel(shared.label, shared.viewer_name, shared.viewer_email)}</div>
                {(shared.label || shared.viewer_name) && (
                  <div className="text-xs text-slate-400">{shared.viewer_email}</div>
                )}
              </div>
              <div className="flex gap-3 text-sm shrink-0">
                <button onClick={() => setEditingId(shared.id)} className="text-sky-700 dark:text-sky-400 hover:underline">
                  Edit
                </button>
                <button onClick={() => remove(shared)} className="text-amber-700 hover:underline">
                  Remove
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {shared.bills.map((b) => (
                <span
                  key={`bill-${b.id}`}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  <BillCategoryIcon category={b.category ?? "Other"} className="w-3 h-3" />
                  {b.name}
                  {b.split_shared && <span className="text-sky-700 dark:text-sky-400">· split</span>}
                </span>
              ))}
              {shared.income.map((s) => (
                <span
                  key={`income-${s.id}`}
                  className="text-xs px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400"
                >
                  {s.name}
                </span>
              ))}
              {shared.bills.length === 0 && shared.income.length === 0 && (
                <span className="text-xs text-slate-400">Nothing shared yet -- edit to choose.</span>
              )}
            </div>
          </div>
        )
      )}

      <AddRelationship bills={bills} income={income} onAdded={refresh} />
    </div>
  );
}

function IncomingShares() {
  const [shares, setShares] = useState<SharedWithMe[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSharedWithMe().then(setShares).catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="text-amber-700 text-sm">{error}</p>;

  if (shares.length === 0) {
    return <p className="text-sm text-slate-400">No one has shared anything with you yet.</p>;
  }

  return (
    <div className="space-y-3">
      {shares.map((shared) => (
        <div key={shared.shared_access_id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <div className="font-medium">{personLabel(shared.label, shared.owner_name, shared.owner_email)}</div>
            {shared.current_period_label && (
              <span className="text-xs text-slate-400">{shared.current_period_label}</span>
            )}
          </div>
          {(shared.label || shared.owner_name) && (
            <div className="text-xs text-slate-400">{shared.owner_email}</div>
          )}

          {shared.bills.length === 0 && shared.income.length === 0 ? (
            <p className="text-xs text-slate-400 pt-1">Nothing shared for the current cycle.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-1">
              {shared.income.map((inc) => (
                <div key={`income-${inc.income_source_id}`} className="flex justify-between items-center py-1.5 text-sm">
                  <span>{inc.name}</span>
                  <span className={inc.is_received ? "text-sky-700 dark:text-sky-400" : "text-slate-400"}>
                    {inc.is_received ? "+" : ""}
                    {fmt(inc.actual_amount)}
                  </span>
                </div>
              ))}
              {shared.bills.map((b) => {
                const isSplit = b.split_shared && b.split_count > 1;
                return (
                  <div key={`bill-${b.bill_source_id}`} className="py-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-1.5">
                        <BillCategoryIcon category={b.category} className="w-4 h-4 shrink-0" />
                        {b.name}
                        {b.is_overdue && (
                          <span className="text-[10px] uppercase tracking-wide font-semibold text-white bg-amber-600 rounded-full px-1.5 py-0.5">
                            Overdue
                          </span>
                        )}
                        {b.is_paid && (
                          <span className="text-[10px] uppercase tracking-wide font-semibold text-sky-700 bg-sky-100 dark:bg-sky-950/40 dark:text-sky-400 rounded-full px-1.5 py-0.5">
                            Paid
                          </span>
                        )}
                      </span>
                      <span className={b.is_paid ? "text-slate-400" : "text-amber-700 dark:text-amber-400 font-medium"}>
                        {fmt(isSplit ? b.split_amount : b.target_amount)}
                      </span>
                    </div>
                    {isSplit && (
                      <div className="text-xs text-slate-400 pl-6">
                        Your share of {fmt(b.target_amount)}, split {b.split_count} ways
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AddPersonToSplit({ billId, onAdded }: { billId: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSaving(true);
    setError(null);
    try {
      await addSplitPartner(billId, { viewer_email: email, label: label || null });
      setEmail("");
      setLabel("");
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-sky-700 dark:text-sky-400 hover:underline">
        + Add person to split with
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex gap-2 items-center flex-wrap pt-1">
      {error && <p className="text-amber-700 text-xs w-full">{error}</p>}
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="text"
        required
        placeholder="Their email or 7-digit ID"
        className="flex-1 min-w-40 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-transparent text-xs"
      />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Name (optional)"
        className="flex-1 min-w-32 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-transparent text-xs"
      />
      <button
        type="submit"
        disabled={saving}
        className="px-2 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium disabled:opacity-60"
      >
        {saving ? "Adding…" : "Add"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400">
        Cancel
      </button>
    </form>
  );
}

function SplitBillRow({ bill, onChanged }: { bill: SplitBill; onChanged: () => void }) {
  const { confirm } = useConfirm();

  async function removePartner(p: SplitPartner) {
    await removeSplitPartner(bill.bill_source_id, p.shared_access_id);
    onChanged();
  }

  async function stopSplitting() {
    const ok = await confirm(
      `Stop splitting "${bill.name}"? It'll go back to showing the full amount instead of a per-person share.`,
      { destructive: true }
    );
    if (!ok) return;
    await updateBillSource(bill.bill_source_id, { split_shared: false });
    onChanged();
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BillCategoryIcon category={bill.category} className="w-4 h-4 shrink-0" />
          <span className="font-medium">{bill.name}</span>
        </div>
        <button onClick={stopSplitting} className="text-xs text-amber-700 hover:underline shrink-0">
          Stop splitting
        </button>
      </div>
      <div className="text-sm">
        {fmt(bill.target_amount)} ÷ {bill.split_count} ={" "}
        <span className="font-medium text-sky-700 dark:text-sky-400">{fmt(bill.split_amount)}</span> each
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">You</span>
        {bill.partners.map((p) => (
          <span
            key={p.shared_access_id}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400"
          >
            {personLabel(p.label, p.viewer_name, p.viewer_email)}
            <button
              onClick={() => removePartner(p)}
              className="text-sky-700 dark:text-sky-400 hover:text-amber-700"
              aria-label={`Remove ${p.viewer_email}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <AddPersonToSplit billId={bill.bill_source_id} onAdded={onChanged} />
    </div>
  );
}

function SplitWithMe() {
  const [shares, setShares] = useState<SharedWithMe[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSharedWithMe().then(setShares).catch((e) => setError(String(e)));
  }, []);

  const rows = shares.flatMap((s) =>
    s.bills.filter((b) => b.split_shared && b.split_count > 1).map((b) => ({ share: s, bill: b }))
  );

  if (error) return <p className="text-amber-700 text-sm">{error}</p>;
  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-400">Split with me</h3>
      {rows.map(({ share, bill }) => (
        <div
          key={`${share.shared_access_id}-${bill.bill_source_id}`}
          className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-1"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BillCategoryIcon category={bill.category} className="w-4 h-4 shrink-0" />
              <span className="font-medium">{bill.name}</span>
            </div>
            <span className="text-xs text-slate-400">
              from {personLabel(share.label, share.owner_name, share.owner_email)}
            </span>
          </div>
          <div className="text-sm">
            {fmt(bill.target_amount)} ÷ {bill.split_count} ={" "}
            <span className="font-medium text-sky-700 dark:text-sky-400">{fmt(bill.split_amount)}</span>{" "}
            your share
          </div>
        </div>
      ))}
    </div>
  );
}

function SplitBills() {
  const [splitBills, setSplitBills] = useState<SplitBill[]>([]);
  const [allBills, setAllBills] = useState<BillSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addBillId, setAddBillId] = useState("");

  function refresh() {
    listSplitBills().then(setSplitBills).catch((e) => setError(String(e)));
    listBillSources()
      .then((all) => setAllBills(all.filter((b) => b.active)))
      .catch((e) => setError(String(e)));
  }

  useEffect(refresh, []);

  const splitIds = new Set(splitBills.map((b) => b.bill_source_id));
  const availableToAdd = allBills.filter((b) => !splitIds.has(b.id));

  async function startSplitting() {
    if (!addBillId) return;
    await updateBillSource(Number(addBillId), { split_shared: true });
    setAddBillId("");
    refresh();
  }

  return (
    <div className="space-y-6">
      <SplitWithMe />

      <div className="space-y-3">
        <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-400">Bills I split</h3>
        {error && <p className="text-amber-700 text-sm">{error}</p>}

        {splitBills.length === 0 && (
          <p className="text-sm text-slate-400">You haven't split any of your own bills yet.</p>
        )}

        {splitBills.map((b) => (
          <SplitBillRow key={b.bill_source_id} bill={b} onChanged={refresh} />
        ))}

        {availableToAdd.length > 0 && (
          <div className="flex gap-2 items-center">
            <select
              value={addBillId}
              onChange={(e) => setAddBillId(e.target.value)}
              className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
            >
              <option value="">Split a bill…</option>
              {availableToAdd.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              onClick={startSplitting}
              disabled={!addBillId}
              className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium disabled:opacity-60"
            >
              Start splitting
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SharingPage() {
  return (
    <RequireAuth>
      <RequirePayCycle>
        <SharingContent />
      </RequirePayCycle>
    </RequireAuth>
  );
}

function SharingContent() {
  const [tab, setTab] = useState<"outgoing" | "incoming" | "split">("outgoing");

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <DashboardHeader active="/sharing" />

      <div>
        <h2 className="font-semibold flex items-center gap-1">
          Sharing
          <InfoTooltip text="Give someone read-only visibility into your finances -- pick exactly which bills and income they can see. They only see it once they have their own account with the email you shared with. Use Split bills to divide a bill's amount evenly between you and specific people." />
        </h2>
      </div>

      <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 text-sm overflow-hidden w-fit flex-wrap">
        <button
          onClick={() => setTab("outgoing")}
          className={`px-4 py-1.5 ${tab === "outgoing" ? "bg-sky-700 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
        >
          People I've shared with
        </button>
        <button
          onClick={() => setTab("incoming")}
          className={`px-4 py-1.5 ${tab === "incoming" ? "bg-sky-700 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
        >
          Shared with me
        </button>
        <button
          onClick={() => setTab("split")}
          className={`px-4 py-1.5 ${tab === "split" ? "bg-sky-700 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
        >
          Split bills
        </button>
      </div>

      {tab === "outgoing" ? <OutgoingShares /> : tab === "incoming" ? <IncomingShares /> : <SplitBills />}
    </main>
  );
}
