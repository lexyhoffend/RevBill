"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  NotPlannable,
  Plan,
  PlanBill,
  PlannerOption,
  SavingsBucket,
  confirmPlan,
  fillFun,
  getPlan,
  listSavingsBuckets,
  updateBillPlan,
  updatePlan,
} from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";
import RequirePayCycle from "@/components/RequirePayCycle";
import AccountNav from "@/components/AccountNav";
import Confetti from "@/components/Confetti";
import IncomeEditor from "@/components/plan/IncomeEditor";
import { useConfirm } from "@/components/ConfirmProvider";
import { money, shortDate } from "@/components/plan/format";

export default function ManagePage() {
  return (
    <RequireAuth>
      <RequirePayCycle>
        <ManageContent />
      </RequirePayCycle>
    </RequireAuth>
  );
}

function ManageContent() {
  const params = useParams<{ id: string }>();
  const periodId = Number(params.id);
  const [plan, setPlan] = useState<Plan | NotPlannable | null>(null);
  const [buckets, setBuckets] = useState<SavingsBucket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const latest = useRef(0);

  // Every change returns the whole updated plan; only the newest response is
  // applied, so quick edits can't be overwritten by an older one.
  const apply = useCallback((p: Promise<Plan | NotPlannable>) => {
    const id = ++latest.current;
    p.then((next) => {
      if (id === latest.current) setPlan(next);
    }).catch((e) => setError(String(e).replace(/^Error:\s*/, "")));
  }, []);
  const refresh = useCallback(() => apply(getPlan(periodId)), [apply, periodId]);

  useEffect(refresh, [refresh]);
  useEffect(() => {
    listSavingsBuckets().then(setBuckets).catch(() => {});
  }, []);

  if (error) return <main className="max-w-2xl mx-auto p-6 text-amber-800 text-sm">{error}</main>;
  if (!plan) return <main className="max-w-2xl mx-auto p-6 text-sm text-slate-400">Loading…</main>;
  if (!plan.plannable) {
    return (
      <main className="max-w-2xl mx-auto p-6 space-y-3">
        <Link href="/" className="text-sm text-slate-500 hover:underline">← Home</Link>
        <p className="text-sm text-slate-600">This older cycle&apos;s bills were all due before its payday, so there&apos;s nothing to plan here.</p>
      </main>
    );
  }

  const p = plan;
  async function confirm() {
    const next = await confirmPlan(p.period_id).catch((e) => {
      setError(String(e).replace(/^Error:\s*/, ""));
      return null;
    });
    if (next) {
      latest.current++;
      setPlan(next);
      setBurst((b) => b + 1);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6 pb-40">
      <div className="flex items-center justify-between gap-6">
        <Link href="/" className="text-sm text-slate-500 hover:underline shrink-0">← Home</Link>
        <AccountNav />
      </div>

      <div className="space-y-1">
        <p className="text-sm text-slate-500">
          Manage your {shortDate(p.pay_date)} paycheck · covers bills through {shortDate(prevDay(p.next_pay_date))}
        </p>
        <h1 className="text-2xl font-bold text-slate-900">Give every dollar a job</h1>
      </div>

      {p.managed_at && <ManagedBanner plan={p} burst={burst} />}

      <Step n={1} title="Income earned">
        <IncomeEditor plan={p} onChanged={refresh} />
        {!p.income.is_received && (
          <p className="text-xs text-slate-500">
            {p.income.label === "Your average"
              ? "Based on your last few paychecks. It updates to the real amount once you enter it."
              : "Based on what you told us. It updates to the real amount once you enter it."}
          </p>
        )}
      </Step>

      <Step n={2} title="Bills this cycle" right={money(p.bills_total)}>
        {p.bills.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing is due before your next payday on {shortDate(p.next_pay_date)}.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {p.bills.map((b) => (
              <BillPlanRow key={b.entry_id} bill={b} plan={p} onApply={apply} />
            ))}
          </ul>
        )}
        <Link href="/sources" className="text-xs text-sky-700 hover:underline">+ Add another bill</Link>
      </Step>

      <Step n={3} title="Future You" right={money(p.future_amount)}>
        <p className="text-xs text-slate-500">Money set aside for savings or a goal.</p>
        <div className="flex items-center gap-2 flex-wrap">
          <AmountInput
            value={p.future_amount}
            isSet={p.future_set}
            label="Future You amount"
            onSave={(n) => apply(updatePlan(p.period_id, { future_amount: n }))}
          />
          {buckets.length > 0 && (
            <select
              value={p.future_bucket?.id ?? ""}
              onChange={(e) =>
                apply(updatePlan(p.period_id, { future_bucket_id: e.target.value ? Number(e.target.value) : null }))
              }
              aria-label="Savings bucket"
              className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
            >
              <option value="">Any savings</option>
              {buckets.map((bk) => (
                <option key={bk.id} value={bk.id}>{bk.name}</option>
              ))}
            </select>
          )}
          {buckets.length === 0 && (
            <Link href="/savings" className="text-xs text-sky-700 hover:underline">Start a savings goal</Link>
          )}
        </div>
      </Step>

      <Step n={4} title="Guilt-free spending" right={money(p.fun_amount)}>
        <p className="text-xs text-slate-500">Yours to spend on anything, no guilt.</p>
        <div className="flex items-center gap-2 flex-wrap">
          <AmountInput
            value={p.fun_amount}
            isSet={p.fun_set}
            label="Guilt-free spending amount"
            onSave={(n) => apply(updatePlan(p.period_id, { fun_amount: n }))}
          />
          {p.still_to_plan > 0 && (
            <button onClick={() => apply(fillFun(p.period_id))} className="text-sm text-sky-700 hover:underline">
              Put the remaining {money(p.still_to_plan)} here
            </button>
          )}
        </div>
      </Step>

      {p.planner && <Planner plan={p} onApply={apply} />}

      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-200">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            {p.over_planned > 0 ? (
              <div className="text-sm font-medium text-amber-800">⚠ {money(p.over_planned)} of bills still to plan</div>
            ) : p.still_to_plan > 0 ? (
              <div className="text-sm font-medium text-amber-800">{money(p.still_to_plan)} still to plan</div>
            ) : (
              <div className="text-sm font-medium text-green-700">✓ Every dollar has a job</div>
            )}
            <div className="text-xs text-slate-500">
              {money(Math.min(p.assigned, p.income.amount))} of {money(p.income.amount)} managed
            </div>
          </div>
          {p.managed_at ? (
            <Link href="/" className="px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium">
              Done
            </Link>
          ) : (
            <button
              onClick={confirm}
              disabled={!p.can_confirm}
              className="px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium disabled:opacity-50"
            >
              Confirm plan
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function prevDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function Step({ n, title, right, children }: { n: number; title: string; right?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs flex items-center justify-center">{n}</span>
          {title}
        </h2>
        {right && <span className="font-semibold text-slate-900">{right}</span>}
      </div>
      {children}
    </section>
  );
}

function AmountInput({
  value,
  isSet,
  label,
  onSave,
}: {
  value: number;
  isSet: boolean;
  label: string;
  onSave: (n: number) => void;
}) {
  const [text, setText] = useState(isSet ? String(value) : "");
  const [lastServer, setLastServer] = useState(value);
  const [editing, setEditing] = useState(false);
  if (!editing && value !== lastServer) {
    setLastServer(value);
    setText(String(value));
  }
  return (
    <div className="flex items-center gap-1">
      <span className="text-slate-500 text-sm">$</span>
      <input
        type="number"
        step="0.01"
        min={0}
        value={text}
        placeholder="0"
        aria-label={label}
        onFocus={() => setEditing(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => {
          setEditing(false);
          const n = Number(e.target.value) || 0;
          if (n !== value || !isSet) onSave(n);
        }}
        className="w-32 border border-slate-300 rounded-lg px-3 py-2 bg-white text-right"
      />
    </div>
  );
}

function BillPlanRow({ bill, plan, onApply }: { bill: PlanBill; plan: Plan; onApply: (p: Promise<Plan>) => void }) {
  const { confirm } = useConfirm();
  const total = bill.planned + bill.deferred;
  const next = shortDate(plan.next_pay_date);

  async function move() {
    if (bill.essential) {
      const ok = await confirm(
        `${bill.name} is the kind of bill that's usually best paid on time (rent or mortgage, loans, card payments). Late payments can mean fees. Move it to your ${next} paycheck anyway?`,
        { title: "Move this bill?", confirmLabel: "Move it" }
      );
      if (!ok) return;
    }
    onApply(updateBillPlan(plan.period_id, bill.entry_id, { planned_amount: 0, deferred_amount: total }));
  }

  function split() {
    const half = Math.round((total / 2) * 100) / 100;
    onApply(updateBillPlan(plan.period_id, bill.entry_id, { planned_amount: half, deferred_amount: Math.round((total - half) * 100) / 100 }));
  }

  return (
    <li className="py-3 space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
            {bill.is_paid && <span className="text-green-700 text-xs">✓ paid</span>}
            {bill.name}
          </div>
          <div className="text-xs text-slate-500">
            {bill.due_date ? `Due ${shortDate(bill.due_date)}` : bill.has_due_day ? "" : "No due day set"}
            {bill.carried_in > 0 && bill.carried_from && ` · includes ${money(bill.carried_in)} moved from your ${shortDate(bill.carried_from)} paycheck`}
            {bill.is_revolving && " · card payment, pick any amount"}
          </div>
        </div>
        <BillAmount bill={bill} plan={plan} onApply={onApply} />
      </div>
      <div className="flex items-center gap-3 text-xs flex-wrap">
        {bill.deferred > 0 && (
          <span className="text-sky-800">↪ {money(bill.deferred)} moved to your {next} paycheck</span>
        )}
        {bill.planned > 0 && (
          <button onClick={move} className="text-sky-700 hover:underline">Move to {next} paycheck</button>
        )}
        {total > 0 && bill.deferred === 0 && (
          <button onClick={split} className="text-sky-700 hover:underline">Split between paychecks</button>
        )}
        {(bill.is_custom || bill.deferred > 0) && (
          <button
            onClick={() => onApply(updateBillPlan(plan.period_id, bill.entry_id, { planned_amount: null, deferred_amount: 0 }))}
            className="text-slate-500 hover:underline"
          >
            Reset
          </button>
        )}
      </div>
    </li>
  );
}

function BillAmount({ bill, plan, onApply }: { bill: PlanBill; plan: Plan; onApply: (p: Promise<Plan>) => void }) {
  const [text, setText] = useState(String(bill.planned));
  const [lastServer, setLastServer] = useState(bill.planned);
  const [editing, setEditing] = useState(false);
  if (!editing && bill.planned !== lastServer) {
    setLastServer(bill.planned);
    setText(String(bill.planned));
  }
  return (
    <div className="flex items-center gap-1 shrink-0">
      <span className="text-slate-500 text-sm">$</span>
      <input
        type="number"
        step="0.01"
        min={0}
        value={text}
        aria-label={`Amount for ${bill.name} from this paycheck`}
        onFocus={() => setEditing(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => {
          setEditing(false);
          const n = Number(e.target.value) || 0;
          if (n !== bill.planned) onApply(updateBillPlan(plan.period_id, bill.entry_id, { planned_amount: n, deferred_amount: bill.deferred }));
        }}
        className="w-28 border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-right font-medium text-slate-900"
      />
    </div>
  );
}

function Planner({ plan, onApply }: { plan: Plan; onApply: (p: Promise<Plan>) => void }) {
  const [script, setScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const planner = plan.planner!;

  function choose(o: PlannerOption) {
    if (o.kind === "move_bill" && o.entry_id != null) {
      const bill = plan.bills.find((b) => b.entry_id === o.entry_id);
      if (bill) onApply(updateBillPlan(plan.period_id, bill.entry_id, { planned_amount: 0, deferred_amount: bill.planned + bill.deferred }));
    } else if (o.kind === "trim_fun" && o.amount != null) {
      onApply(updatePlan(plan.period_id, { fun_amount: Math.max(plan.fun_amount - o.amount, 0) }));
    } else if (o.kind === "trim_future" && o.amount != null) {
      onApply(updatePlan(plan.period_id, { future_amount: Math.max(plan.future_amount - o.amount, 0) }));
    } else if (o.kind === "due_date_script" && o.script) {
      setScript(o.script);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-3">
      <div className="text-sm font-medium text-amber-900">⚠ {planner.message}</div>
      <div className="text-xs text-slate-600">Pick one and your plan updates:</div>
      <div className="flex flex-col gap-2">
        {planner.options.map((o, i) => (
          <button
            key={i}
            onClick={() => choose(o)}
            className="text-left text-sm px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-sky-400 hover:bg-sky-50"
          >
            {o.text}
          </button>
        ))}
      </div>
      {script && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs text-slate-500">Copy this and send it to the biller (or read it on the phone):</p>
          <p className="text-sm text-slate-800">{script}</p>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(script);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-sm text-sky-700 hover:underline"
          >
            {copied ? "Copied!" : "Copy script"}
          </button>
        </div>
      )}
    </section>
  );
}

function ManagedBanner({ plan, burst }: { plan: Plan; burst: number }) {
  return (
    <section className="relative rounded-2xl border border-orange-200 bg-orange-50 p-5 space-y-3">
      <Confetti burstKey={burst} count={28} />
      <div className="text-base font-semibold text-orange-950">
        🎉 Done! Every dollar of your {money(plan.income.amount)} has a job.
      </div>
      <div className="text-sm text-slate-700">Want to do more? These are optional:</div>
      <div className="flex gap-3 flex-wrap text-sm">
        <Link href="/sources" className="text-sky-700 hover:underline">Add more bills</Link>
        <Link href="/savings" className="text-sky-700 hover:underline">Set up a savings goal</Link>
        <Link href={`/period/${plan.period_id}`} className="text-sky-700 hover:underline">Check off bills as you pay</Link>
      </div>
    </section>
  );
}
