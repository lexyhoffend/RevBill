"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BILL_CATEGORIES,
  BillSource,
  CadenceType,
  CREDIT_CARD_ISSUERS,
  IncomeSource,
  WEEKDAY_LABELS,
  createBillSource,
  createIncomeSource,
  createPeriod,
  deleteBillSource,
  deleteIncomeSource,
  listBillSources,
  listIncomeSources,
  listPeriods,
  updateBillSource,
  updateIncomeSource,
} from "@/lib/api";
import { findCurrentPeriod, todayIso } from "@/lib/periodUtils";
import RequireAuth from "@/components/RequireAuth";
import RequirePayCycle from "@/components/RequirePayCycle";
import AccountNav from "@/components/AccountNav";
import { useConfirm } from "@/components/ConfirmProvider";

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const CADENCE_LABELS: Record<CadenceType, string> = {
  monthly_date: "Custom date of month",
  semimonthly: "Twice a month",
  weekly: "Weekly",
  biweekly: "Bi-weekly",
};

function usesDayOfMonth(c: CadenceType): boolean {
  return c === "monthly_date" || c === "semimonthly";
}

function describeCadence(s: IncomeSource): string {
  if (s.cadence_type === "monthly_date") return `Monthly on the ${s.cadence_day_of_month}${ordinal(s.cadence_day_of_month || 0)}`;
  if (s.cadence_type === "semimonthly") {
    const d1 = s.cadence_day_of_month || 1;
    const d2 = s.cadence_day_of_month2 || 31;
    return `Twice a month on the ${d1}${ordinal(d1)} and ${d2 >= 31 ? "last day" : `${d2}${ordinal(d2)}`}`;
  }
  const day = WEEKDAY_LABELS[s.cadence_weekday ?? 0];
  return s.cadence_type === "weekly" ? `Weekly on ${day}` : `Every 2 weeks on ${day}`;
}

function weekdayFromIsoDate(iso: string): number {
  // Parsed in local time (not UTC midnight) so the weekday matches what the date
  // picker actually shows. Converts JS's Sun=0..Sat=6 to this app's Mon=0..Sun=6.
  const d = new Date(`${iso}T00:00:00`);
  return (d.getDay() + 6) % 7;
}

function ordinal(n: number): string {
  if (n % 10 === 1 && n !== 11) return "st";
  if (n % 10 === 2 && n !== 12) return "nd";
  if (n % 10 === 3 && n !== 13) return "rd";
  return "th";
}

function IncomeSourceRow({ source, onChanged }: { source: IncomeSource; onChanged: () => void }) {
  const { confirm, notify } = useConfirm();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(source.name);
  const [amount, setAmount] = useState(String(source.amount));
  const [cadenceType, setCadenceType] = useState<CadenceType>(source.cadence_type);
  const [dayOfMonth, setDayOfMonth] = useState(String(source.cadence_day_of_month ?? 1));
  const [dayOfMonth2, setDayOfMonth2] = useState(String(source.cadence_day_of_month2 ?? 31));
  const [startDate, setStartDate] = useState(source.start_date);

  async function save() {
    await updateIncomeSource(source.id, {
      name,
      amount: Number(amount) || 0,
      cadence_type: cadenceType,
      cadence_day_of_month: usesDayOfMonth(cadenceType) ? Number(dayOfMonth) : null,
      cadence_day_of_month2: cadenceType === "semimonthly" ? Number(dayOfMonth2) : null,
      // Derived from start_date, not a separately-editable field -- keeps the two
      // from ever drifting out of sync (which used to silently break matching).
      cadence_weekday: usesDayOfMonth(cadenceType) ? null : weekdayFromIsoDate(startDate),
      start_date: startDate,
    });
    setEditing(false);
    onChanged();
  }

  async function remove() {
    const ok = await confirm(`Remove "${source.name}"? If it has history, it'll be archived instead of deleted.`, {
      destructive: true,
    });
    if (!ok) return;
    const result = await deleteIncomeSource(source.id);
    if (result.deactivated) {
      await notify(`"${source.name}" has past period history, so it was archived instead of deleted.`);
    }
    onChanged();
  }

  if (editing) {
    return (
      <div className="space-y-2 py-2 border-b border-sky-100 dark:border-sky-900/40">
        <div className="flex gap-2 items-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-transparent"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            className="w-24 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-transparent"
          />
          <select
            value={cadenceType}
            onChange={(e) => setCadenceType(e.target.value as CadenceType)}
            className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-transparent"
          >
            {Object.entries(CADENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {usesDayOfMonth(cadenceType) && (
            <label className="flex items-center gap-2 text-xs">
              Day of month
              <input
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                type="number"
                min={1}
                max={31}
                className="w-16 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-transparent"
              />
            </label>
          )}
          {cadenceType === "semimonthly" && (
            <label className="flex items-center gap-2 text-xs">
              and
              <input
                value={dayOfMonth2}
                onChange={(e) => setDayOfMonth2(e.target.value)}
                type="number"
                min={1}
                max={31}
                aria-label="Second pay day"
                className="w-16 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-transparent"
              />
            </label>
          )}
          <label className="flex items-center gap-2 text-xs">
            Recurs starting
            <input
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              type="date"
              className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-transparent"
            />
          </label>
          {!usesDayOfMonth(cadenceType) && (
            <span className="text-xs text-slate-400">({WEEKDAY_LABELS[weekdayFromIsoDate(startDate)]})</span>
          )}
          <button onClick={save} className="text-xs text-sky-700 dark:text-sky-400 font-medium">
            Save
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-slate-400">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center py-2 border-b border-sky-100 dark:border-sky-900/40">
      <div>
        <div className="text-sm font-medium">{source.name}</div>
        <div className="text-xs text-slate-400">{describeCadence(source)}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sky-700 dark:text-sky-400 font-medium">
          +${source.amount.toLocaleString()}
        </span>
        <button onClick={() => setEditing(true)} className="text-xs text-slate-500 hover:underline">
          Edit
        </button>
        <button onClick={remove} className="text-xs text-amber-700 hover:underline">
          Delete
        </button>
      </div>
    </div>
  );
}

function BillSourceRow({ source, onChanged }: { source: BillSource; onChanged: () => void }) {
  const { confirm, notify } = useConfirm();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(source.name);
  const [amount, setAmount] = useState(String(source.default_target_amount));
  const [revolving, setRevolving] = useState(source.is_revolving);
  const [issuer, setIssuer] = useState(source.credit_card_issuer ?? CREDIT_CARD_ISSUERS[0]);
  const [dueDay, setDueDay] = useState(source.due_day != null ? String(source.due_day) : "");
  const [split, setSplit] = useState(source.split_shared);

  async function save() {
    await updateBillSource(source.id, {
      name,
      default_target_amount: Number(amount) || 0,
      is_revolving: revolving,
      credit_card_issuer: source.category === "Credit Card" ? issuer : null,
      due_day: dueDay ? Number(dueDay) : null,
      split_shared: split,
    });
    setEditing(false);
    onChanged();
  }

  async function remove() {
    const ok = await confirm(`Remove "${source.name}"? If it has history, it'll be archived instead of deleted.`, {
      destructive: true,
    });
    if (!ok) return;
    const result = await deleteBillSource(source.id);
    if (result.deactivated) {
      await notify(`"${source.name}" has past period history, so it was archived instead of deleted.`);
    }
    onChanged();
  }

  if (source.shared_access_bill_id != null) {
    return (
      <div className="flex justify-between items-center py-2 border-b border-amber-100 dark:border-amber-900/30">
        <div>
          <div className="text-sm font-medium flex items-center gap-2">
            {source.name}
            <span className="text-[10px] uppercase tracking-wide text-sky-700 bg-sky-100 dark:bg-sky-950/40 dark:text-sky-400 rounded-full px-1.5 py-0.5">
              Shared
            </span>
          </div>
          <div className="text-xs text-slate-400">
            {source.category} · auto-tracked from a split -- amount updates automatically
          </div>
        </div>
        <span className="text-amber-700 dark:text-amber-400 font-medium">
          -${source.default_target_amount.toLocaleString()}
        </span>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex gap-2 items-center py-2 border-b border-amber-100 dark:border-amber-900/30">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-0 w-20 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-transparent"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          className="w-24 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-transparent"
        />
        <label className="flex items-center gap-1 text-xs whitespace-nowrap">
          <input type="checkbox" checked={revolving} onChange={(e) => setRevolving(e.target.checked)} />
          Revolving
        </label>
        <label
          className="flex items-center gap-1 text-xs whitespace-nowrap"
          title="Divide this bill's amount evenly across you and everyone it's shared with (Sharing tab)"
        >
          <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />
          Split with sharers
        </label>
        <input
          value={dueDay}
          onChange={(e) => setDueDay(e.target.value)}
          type="number"
          min={1}
          max={31}
          placeholder="Due day"
          title="Day of month this bill is due"
          className="w-28 shrink-0 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-transparent"
        />
        {source.category === "Credit Card" && (
          <select
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-transparent"
          >
            {CREDIT_CARD_ISSUERS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        )}
        <button onClick={save} className="text-xs text-sky-700 dark:text-sky-400 font-medium">
          Save
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-slate-400">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center py-2 border-b border-amber-100 dark:border-amber-900/30">
      <div>
        <div className="text-sm font-medium">
          {source.name}
          {source.is_revolving && <span className="ml-2 text-[10px] uppercase text-slate-400">revolving</span>}
        </div>
        <div className="text-xs text-slate-400">
          {source.category}
          {source.credit_card_issuer && ` · ${source.credit_card_issuer}`}
          {source.due_day && ` · due on the ${source.due_day}${ordinal(source.due_day)}`}
          {source.split_shared && " · split with sharers"}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-amber-700 dark:text-amber-400 font-medium">
          -${source.default_target_amount.toLocaleString()}
        </span>
        <button onClick={() => setEditing(true)} className="text-xs text-slate-500 hover:underline">
          Edit
        </button>
        <button onClick={remove} className="text-xs text-amber-700 hover:underline">
          Delete
        </button>
      </div>
    </div>
  );
}

export default function SourcesPage() {
  const router = useRouter();
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [billSources, setBillSources] = useState<BillSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Payment Cycle form state
  const [cycleName, setCycleName] = useState("");
  const [cadenceType, setCadenceType] = useState<CadenceType>("biweekly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [dayOfMonth2, setDayOfMonth2] = useState("31");
  const [startDate, setStartDate] = useState(todayIso());
  const [cycleAmount, setCycleAmount] = useState("");

  // Bill form state
  const [billCategory, setBillCategory] = useState(BILL_CATEGORIES[0]);
  const [billCustomName, setBillCustomName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billRevolving, setBillRevolving] = useState(false);
  const [billIssuer, setBillIssuer] = useState(CREDIT_CARD_ISSUERS[0]);
  const [billDueDay, setBillDueDay] = useState("");
  const [billFormError, setBillFormError] = useState<string | null>(null);
  const needsBillName = billCategory === "Other" || billCategory === "Credit Card";

  function refresh() {
    listIncomeSources().then(setIncomeSources).catch((e) => setError(String(e)));
    listBillSources().then(setBillSources).catch((e) => setError(String(e)));
  }

  useEffect(refresh, []);

  async function handleAddCycle(e: React.FormEvent) {
    e.preventDefault();
    if (!cycleName) return;
    await createIncomeSource({
      name: cycleName,
      cadence_type: cadenceType,
      cadence_day_of_month: usesDayOfMonth(cadenceType) ? Number(dayOfMonth) : null,
      cadence_day_of_month2: cadenceType === "semimonthly" ? Number(dayOfMonth2) : null,
      cadence_weekday: !usesDayOfMonth(cadenceType) ? weekdayFromIsoDate(startDate) : null,
      start_date: startDate,
      amount: Number(cycleAmount) || 0,
    });
    setCycleName("");
    setCycleAmount("");
    refresh();
  }

  async function handleAddBill(e: React.FormEvent) {
    e.preventDefault();
    const name = needsBillName ? billCustomName : billCategory;
    if (!name) {
      setBillFormError(
        billCategory === "Credit Card" ? "Give this card a name first." : "Give this bill a name first."
      );
      return;
    }
    setBillFormError(null);
    try {
      await createBillSource({
        name,
        category: billCategory,
        default_target_amount: Number(billAmount) || 0,
        is_revolving: billRevolving,
        credit_card_issuer: billCategory === "Credit Card" ? billIssuer : null,
        due_day: billDueDay ? Number(billDueDay) : null,
      });
    } catch (err) {
      setBillFormError(String(err));
      return;
    }
    setBillCustomName("");
    setBillAmount("");
    setBillRevolving(false);
    setBillDueDay("");
    refresh();
  }

  async function handleDone() {
    setFinishing(true);
    try {
      // Land on today's period if one's already there, otherwise create the
      // current one -- either way the user ends up looking at a payments-vs-bills table.
      const existing = await listPeriods();
      const current = findCurrentPeriod(existing);
      if (current) {
        router.push(`/period/${current.id}`);
        return;
      }
      const start = todayIso();
      const end = addDaysIso(start, 13);
      const label = `Payment Cycle ${new Date(start).toLocaleDateString()}`;
      const period = await createPeriod({ label, start_date: start, end_date: end });
      router.push(`/period/${period.id}`);
    } catch (e) {
      setError(String(e));
      setFinishing(false);
    }
  }

  const activeIncome = incomeSources.filter((s) => s.active);
  const archivedIncome = incomeSources.filter((s) => !s.active);
  const activeBills = billSources.filter((s) => s.active);
  const archivedBills = billSources.filter((s) => !s.active);

  return (
    <RequireAuth>
      <RequirePayCycle>
      <main className="max-w-2xl mx-auto p-6 space-y-10">
        <div className="flex items-center justify-between gap-6">
          <Link href="/" className="text-sm text-slate-500 hover:underline shrink-0">
            ← Back
          </Link>
          <AccountNav />
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              Set up Rev<span className="text-sky-700 dark:text-sky-400">Bill</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">Add your payment cycles (income) and bills below.</p>
            <Link href="/setup-cycle" className="text-xs text-sky-700 dark:text-sky-400 hover:underline">
              Change cycle schedule
            </Link>
          </div>
          <button
            onClick={handleDone}
            disabled={finishing}
            className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium disabled:opacity-60"
          >
            {finishing ? "Loading…" : "Done — View my Payments & Bills"}
          </button>
        </div>
        {error && <p className="text-amber-700 text-sm">{error}</p>}

      <section className="space-y-3">
        <h2 className="font-semibold text-sky-700 dark:text-sky-400">Payment Cycles</h2>
        <p className="text-xs text-slate-400">
          One per job or income source (e.g. "Employer" vs "Rent Received") — each with its own schedule.
        </p>
        <div>
          {activeIncome.map((s) => (
            <IncomeSourceRow key={s.id} source={s} onChanged={refresh} />
          ))}
        </div>

        <form onSubmit={handleAddCycle} className="rounded-xl border border-sky-200 dark:border-sky-900/50 p-4 space-y-3 bg-sky-50/40 dark:bg-sky-950/20">
          <div className="flex gap-2">
            <input
              value={cycleName}
              onChange={(e) => setCycleName(e.target.value)}
              placeholder="Name"
              className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
            />
            <select
              value={cadenceType}
              onChange={(e) => setCadenceType(e.target.value as CadenceType)}
              className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
            >
              {Object.entries(CADENCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            {usesDayOfMonth(cadenceType) && (
              <label className="flex items-center gap-2 text-sm">
                Day of month
                <input
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  type="number"
                  min={1}
                  max={31}
                  className="w-20 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
                />
              </label>
            )}
          {cadenceType === "semimonthly" && (
            <label className="flex items-center gap-2 text-sm">
              and
              <input
                value={dayOfMonth2}
                onChange={(e) => setDayOfMonth2(e.target.value)}
                type="number"
                min={1}
                max={31}
                aria-label="Second pay day"
                className="w-20 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
              />
            </label>
          )}
            <label className="flex items-center gap-2 text-sm">
              Start date
              <input
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                type="date"
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
              />
            </label>
            {!usesDayOfMonth(cadenceType) && (
              <span className="text-xs text-slate-400">({WEEKDAY_LABELS[weekdayFromIsoDate(startDate)]})</span>
            )}
            <input
              value={cycleAmount}
              onChange={(e) => setCycleAmount(e.target.value)}
              type="number"
              placeholder="Amount received $"
              className="w-40 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
            />
            <button type="submit" className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium">
              Add Payment Cycle
            </button>
          </div>
        </form>

        {archivedIncome.length > 0 && (
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer">Archived ({archivedIncome.length})</summary>
            {archivedIncome.map((s) => (
              <div key={s.id} className="flex justify-between py-1">
                <span>{s.name}</span>
                <span>+${s.amount}</span>
              </div>
            ))}
          </details>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-amber-700 dark:text-amber-400">Bills</h2>
        <p className="text-xs text-slate-400">
          Mark a bill "revolving" (credit cards) if you sometimes pay less than the full amount. Due day is
          optional -- set it (1–31) to get accurate due-date and overdue reminders on your dashboard,
          independent of your pay schedule.
        </p>
        <div>
          {activeBills.map((s) => (
            <BillSourceRow key={s.id} source={s} onChanged={refresh} />
          ))}
        </div>

        <form onSubmit={handleAddBill} className="rounded-xl border border-amber-200 dark:border-amber-900/40 p-4 space-y-3 bg-amber-50/30 dark:bg-amber-950/10">
          {billFormError && <p className="text-amber-700 dark:text-amber-400 text-sm">{billFormError}</p>}
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={billCategory}
              onChange={(e) => setBillCategory(e.target.value)}
              className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
            >
              {BILL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {needsBillName && (
              <input
                value={billCustomName}
                onChange={(e) => {
                  setBillCustomName(e.target.value);
                  setBillFormError(null);
                }}
                placeholder={
                  billCategory === "Credit Card" ? "Name this card (required), e.g. Visa Rewards" : "Name this bill (required)"
                }
                required
                className={`flex-1 min-w-40 w-40 border rounded-lg px-3 py-2 bg-transparent text-sm ${
                  billFormError
                    ? "border-amber-400 dark:border-amber-600"
                    : "border-slate-300 dark:border-slate-600"
                }`}
              />
            )}
            {billCategory === "Credit Card" && (
              <select
                value={billIssuer}
                onChange={(e) => setBillIssuer(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
              >
                {CREDIT_CARD_ISSUERS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            )}
            <input
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
              type="number"
              placeholder="Amount $"
              className="w-28 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
            />
            <input
              value={billDueDay}
              onChange={(e) => setBillDueDay(e.target.value)}
              type="number"
              min={1}
              max={31}
              placeholder="Due day"
              title="Day of month this bill is due"
              className="w-32 shrink-0 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
            />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={billRevolving} onChange={(e) => setBillRevolving(e.target.checked)} />
              Revolving
            </label>
            <button type="submit" className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium">
              Add Bill
            </button>
          </div>
        </form>

        {archivedBills.length > 0 && (
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer">Archived ({archivedBills.length})</summary>
            {archivedBills.map((s) => (
              <div key={s.id} className="flex justify-between py-1">
                <span>{s.name}</span>
                <span>-${s.default_target_amount}</span>
              </div>
            ))}
          </details>
        )}
      </section>
      </main>
      </RequirePayCycle>
    </RequireAuth>
  );
}
