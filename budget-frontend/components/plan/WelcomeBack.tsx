"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NotPlannable, Plan, getCurrentPlan } from "@/lib/api";
import ProgressRing from "@/components/plan/ProgressRing";
import IncomeEditor from "@/components/plan/IncomeEditor";
import { money, shortDate } from "@/components/plan/format";

/** Home screen: opening the app starts with what you EARNED and how much of
 * it already has a job. Money is never "short" -- only "still to plan". */
export default function WelcomeBack() {
  const [plan, setPlan] = useState<Plan | NotPlannable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const refresh = useCallback(() => {
    const id = ++latest.current;
    getCurrentPlan()
      .then((p) => {
        if (id === latest.current) setPlan(p);
      })
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(refresh, [refresh]);

  if (error) return <p className="text-amber-800 text-sm">{error}</p>;
  if (!plan) return <p className="text-sm text-slate-400">Loading…</p>;

  if (!plan.plannable) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
        <h2 className="text-xl font-semibold">Welcome back{plan.name ? `, ${plan.name}` : ""}!</h2>
        <p className="text-sm text-slate-600">
          Planning each paycheck works with an automatic pay schedule (weekly, every 2 weeks, twice a month, or
          monthly).
        </p>
        <Link href="/setup-cycle" className="inline-block px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium">
          Set your pay schedule
        </Link>
      </section>
    );
  }

  const name = plan.name ? `, ${plan.name.split(" ")[0]}` : "";
  const amount = money(plan.income.amount);
  const managed = Math.min(plan.assigned, plan.income.amount);
  const greeting = plan.managed_at
    ? `Nice work${name}! Every dollar of your ${amount} has a job.`
    : plan.income.is_received
    ? `Welcome back${name}! Let's best manage the ${amount} you EARNED!`
    : `Welcome${plan.is_current ? " back" : ""}${name}! Let's manage the ${amount} you EARN.`;

  const billsHandled = plan.bills.every((b) => b.planned + b.deferred + 0.005 >= b.amount_due + b.carried_in);
  const groups = [
    {
      key: "bills",
      title: "Bills this cycle",
      amount: plan.bills_total,
      done: billsHandled,
      detail: plan.bills.length ? `${plan.bills.length} bill${plan.bills.length === 1 ? "" : "s"} before ${shortDate(plan.next_pay_date)}` : "Nothing due before your next payday",
    },
    {
      key: "future",
      title: "Future You",
      amount: plan.future_amount,
      done: plan.future_set,
      detail: plan.future_set ? (plan.future_bucket ? `Into ${plan.future_bucket.name}` : "Savings and goals") : "Not set yet",
    },
    {
      key: "fun",
      title: "Guilt-free spending",
      amount: plan.fun_amount,
      done: plan.fun_set,
      detail: plan.fun_set ? "Yours to enjoy" : "Not set yet",
    },
  ];

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="space-y-1">
          <p className="text-sm text-slate-500">
            {plan.is_current ? "Your paycheck from" : "Your upcoming paycheck on"} {shortDate(plan.pay_date)}
          </p>
          <h2 className="text-xl font-semibold text-slate-900">{greeting}</h2>
        </div>
        <IncomeEditor plan={plan} onChanged={refresh} />

        <div className="flex items-center gap-5 flex-wrap">
          <ProgressRing managed={managed} total={plan.income.amount} />
          <div className="space-y-1">
            <div className="text-lg font-semibold text-slate-900">
              {money(managed)} of {amount} managed
            </div>
            {plan.managed_at ? (
              <div className="text-sm font-medium text-green-700">✓ This paycheck is fully managed</div>
            ) : plan.over_planned > 0 ? (
              <div className="text-sm font-medium text-amber-800">{money(plan.over_planned)} of bills still to plan</div>
            ) : (
              <div className="text-sm text-slate-600">{money(plan.still_to_plan)} still to plan</div>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {groups.map((g) => (
            <div key={g.key} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">{g.title}</span>
                {g.done ? (
                  <span className="text-xs font-medium text-green-700">✓ Handled</span>
                ) : (
                  <span className="text-xs text-slate-400">To do</span>
                )}
              </div>
              <div className="text-xl font-semibold text-slate-900 mt-1">{money(g.amount)}</div>
              <div className="text-xs text-slate-500">{g.detail}</div>
            </div>
          ))}
          <StillToPlanCard plan={plan} />
        </div>

        {plan.managed_at ? (
          <Link href={`/period/${plan.period_id}`} className="inline-block text-sm text-sky-700 hover:underline">
            Check off bills as you pay them →
          </Link>
        ) : (
          <Link
            href={`/manage/${plan.period_id}`}
            className="block text-center w-full px-4 py-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-medium"
          >
            Finish managing
          </Link>
        )}
      </div>

      {plan.bills.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
          <div className="text-sm font-medium text-slate-800">Bills this cycle</div>
          <ul className="divide-y divide-slate-100">
            {plan.bills.map((b) => (
              <li key={b.entry_id} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2">
                  {b.is_paid ? <span className="text-green-700" aria-label="Paid">✓</span> : <span className="w-3" />}
                  <span className="text-slate-800">{b.name}</span>
                  <span className="text-xs text-slate-400">
                    {b.due_date ? `due ${shortDate(b.due_date)}` : b.carried_from ? `moved from ${shortDate(b.carried_from)}` : ""}
                  </span>
                </span>
                <span className="text-slate-800 font-medium">{money(b.planned)}</span>
              </li>
            ))}
          </ul>
          <Link href={`/period/${plan.period_id}`} className="text-xs text-sky-700 hover:underline">
            Open this cycle to mark bills paid →
          </Link>
        </div>
      )}
    </section>
  );
}

function StillToPlanCard({ plan }: { plan: Plan }) {
  const done = plan.still_to_plan < 0.005 && plan.over_planned < 0.005;
  return (
    <div className={`rounded-xl border p-4 ${done ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">Still to plan</span>
        {done ? (
          <span className="text-xs font-medium text-green-700">✓ Every dollar has a job</span>
        ) : (
          <span className="text-xs font-medium text-amber-800">Fix this</span>
        )}
      </div>
      <div className="text-xl font-semibold text-slate-900 mt-1">{money(plan.over_planned > 0 ? plan.over_planned : plan.still_to_plan)}</div>
      <div className="text-xs text-slate-500">
        {done ? "Nothing left to assign" : plan.over_planned > 0 ? "Bills that still need dollars" : "Dollars still waiting for a job"}
      </div>
    </div>
  );
}
