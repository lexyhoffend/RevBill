"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardSummary, PayCycleMode, getDashboardSummary } from "@/lib/api";
import { useAuth } from "@/components/RequireAuth";
import Confetti from "@/components/Confetti";
import CategoryPieChart from "@/components/CategoryPieChart";
import InfoTooltip from "@/components/InfoTooltip";
import BillCategoryIcon from "@/components/BillCategoryIcon";
import MonthlyRecap from "@/components/MonthlyRecap";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type ViewPeriod = "cycle" | "monthly" | "annual";

// Label for the per-cycle tab. A monthly schedule gets no separate tab --
// one cycle already is the Monthly view.
function cycleTabLabel(mode: PayCycleMode | null | undefined): string | null {
  if (mode === "biweekly") return "Bi-weekly";
  if (mode === "weekly") return "Weekly";
  if (mode === "monthly") return null;
  return "This cycle";
}

const PERIOD_TOTAL_LABEL: Record<ViewPeriod, string> = {
  cycle: "this cycle",
  monthly: "this month",
  annual: "this year",
};

// Last card balances seen on this page, so a payoff is celebrated once, here,
// after the payments are actually saved -- not the instant a checkbox fills
// in a full amount on the cycle page. Per-browser convenience only.
const CARD_BALANCES_KEY = "revbill:lastCardBalances";

function readSeenBalances(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(CARD_BALANCES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSeenBalances(balances: Record<string, number>) {
  try {
    localStorage.setItem(CARD_BALANCES_KEY, JSON.stringify(balances));
  } catch {
    // storage unavailable (private window etc.) -- just skip the celebration memory
  }
}

function PeriodTabs({
  value,
  onChange,
  cycleLabel,
}: {
  value: ViewPeriod;
  onChange: (p: ViewPeriod) => void;
  cycleLabel: string | null;
}) {
  const tabs: { key: ViewPeriod; label: string }[] = [
    ...(cycleLabel ? [{ key: "cycle" as const, label: cycleLabel }] : []),
    { key: "monthly", label: "Monthly" },
    { key: "annual", label: "Annual" },
  ];
  return (
    <div className="flex rounded-lg border border-slate-200 text-xs overflow-hidden shrink-0">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-3 py-1 ${value === t.key ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function EstimateLine({
  label,
  perCycle,
  period,
  cyclesPerYear,
  cycleCount,
}: {
  label: string;
  perCycle: number | null;
  period: ViewPeriod;
  cyclesPerYear: number;
  cycleCount: number;
}) {
  const multiplier = period === "cycle" ? 1 : period === "monthly" ? cyclesPerYear / 12 : cyclesPerYear;
  return (
    <div className="flex justify-between items-baseline text-sm text-slate-500">
      <span className="flex items-center gap-1">
        {label} ({PERIOD_TOTAL_LABEL[period].replace("this ", "per ")})
        <InfoTooltip
          text={
            cycleCount > 0
              ? `Average per pay cycle across your ${cycleCount} completed cycle${cycleCount === 1 ? "" : "s"} with activity, scaled to this view. Leaves out one-time income and credit card payments, and doesn't count the cycle you're in now. Gets more accurate as you complete more cycles.`
              : "Appears once you've completed at least one pay cycle with income received or bills paid."
          }
        />
      </span>
      <span>{perCycle == null ? "Not enough history yet" : fmt(perCycle * multiplier)}</span>
    </div>
  );
}

export default function AtAGlance() {
  const auth = useAuth();
  const cycleLabel = cycleTabLabel(auth.status === "authed" ? auth.user.pay_cycle_mode : null);
  const defaultPeriod: ViewPeriod = cycleLabel ? "cycle" : "monthly";
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billPeriod, setBillPeriod] = useState<ViewPeriod>(defaultPeriod);
  const [incomePeriod, setIncomePeriod] = useState<ViewPeriod>(defaultPeriod);
  const [paidOffNames, setPaidOffNames] = useState<string[]>([]);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    getDashboardSummary()
      .then((data) => {
        setSummary(data);
        const seen = readSeenBalances();
        const now: Record<string, number> = {};
        const newlyPaidOff: string[] = [];
        for (const c of data.cards_owed) {
          now[c.bill_source_id] = c.owed_balance;
          const before = seen?.[c.bill_source_id];
          if (before !== undefined && before > 0 && c.owed_balance === 0) newlyPaidOff.push(c.name);
        }
        writeSeenBalances(now);
        if (newlyPaidOff.length > 0) {
          setPaidOffNames(newlyPaidOff);
          setBurstKey((k) => k + 1);
        }
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!summary) return <p className="text-sm text-slate-400">Loading your at-a-glance summary…</p>;

  const {
    current_period_id,
    current_period_label,
    current_left_over,
    total_owed,
    cards_owed,
    bills_due_soon,
    total_saved_all_buckets,
    total_savings_goal,
    bill_categories,
    monthly_bills_total,
    annual_bills_total,
    income_sources,
    monthly_income_total,
    annual_income_total,
    bills_percent_of_income,
    cycle_bills_total,
    cycle_income_total,
    estimated_income_per_cycle,
    estimated_bills_per_cycle,
    estimate_cycle_count,
    cycles_per_year,
  } = summary;
  const pick = (p: ViewPeriod, cycle: number, monthly: number, annual: number) =>
    p === "cycle" ? cycle : p === "monthly" ? monthly : annual;

  const savingsPct =
    total_savings_goal && total_savings_goal > 0
      ? Math.min(Math.round((total_saved_all_buckets / total_savings_goal) * 100), 100)
      : null;

  const pieSlices = bill_categories
    .map((c) => ({ label: c.category, value: pick(billPeriod, c.cycle, c.monthly, c.annual) }))
    .filter((s) => s.value > 0);

  const billPeriodTotal = pick(billPeriod, cycle_bills_total, monthly_bills_total, annual_bills_total);

  const incomePieSlices = income_sources
    .map((s) => ({ label: s.category, value: pick(incomePeriod, s.cycle, s.monthly, s.annual) }))
    .filter((s) => s.value > 0);

  const incomePeriodTotal = pick(incomePeriod, cycle_income_total, monthly_income_total, annual_income_total);

  return (
    <section className="space-y-4">
      {paidOffNames.length > 0 && (
        <div className="relative rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-4 flex items-center justify-between gap-3">
          <Confetti burstKey={burstKey} count={24} />
          <div className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            🎉 Paid off! {paidOffNames.join(", ")} {paidOffNames.length === 1 ? "is" : "are"} down to $0.
          </div>
          <button onClick={() => setPaidOffNames([])} className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      <MonthlyRecap summary={summary} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            Owed on cards
            <InfoTooltip text="Total remaining balance across all your revolving (credit card) bills, as of the current cycle. Doesn't include regular bills like rent or utilities." />
          </div>
          <div className="text-xl font-semibold text-red-600">{fmt(total_owed)}</div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            {current_period_label ? "Left this cycle" : "Left"}
            <InfoTooltip text="Income received minus bills paid and money moved to savings, for your current pay cycle. Updates as you mark things paid or received." />
          </div>
          <div className={`text-xl font-semibold ${current_left_over < 0 ? "text-red-600" : "text-emerald-700"}`}>
            {fmt(current_left_over)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            Total saved
            <InfoTooltip text="Combined balance across every savings bucket you've set up, regardless of which one has a goal." />
          </div>
          <div className="text-xl font-semibold text-emerald-700">{fmt(total_saved_all_buckets)}</div>
          {savingsPct !== null && <div className="text-xs text-slate-400">{savingsPct}% of goals</div>}
        </div>
      </div>

      {bill_categories.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium flex items-center gap-1">
                Recurring bills
                <InfoTooltip text="The per-cycle tab shows amounts actually paid in your current pay cycle. Monthly shows cycles whose pay date falls in the current calendar month, and Annual the current calendar year. Not a projection -- an unpaid bill contributes nothing until it's paid. The estimate line below is the projection." />
              </div>
              <div className="text-xs text-slate-400">
                Actual amounts paid, by category -- revolving cards aren't included here since they're tracked
                separately below.
              </div>
            </div>
            <PeriodTabs value={billPeriod} onChange={setBillPeriod} cycleLabel={cycleLabel} />
          </div>

          {pieSlices.length > 0 && (
            <CategoryPieChart
              slices={pieSlices}
              renderIcon={(label, color) => (
                <BillCategoryIcon category={label} color={color} className="w-3.5 h-3.5 shrink-0" />
              )}
            />
          )}

          <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 font-medium text-sm">
            <span>Total ({PERIOD_TOTAL_LABEL[billPeriod]})</span>
            <span>{fmt(billPeriodTotal)}</span>
          </div>
          <EstimateLine
            label="Estimated recurring bills"
            perCycle={estimated_bills_per_cycle}
            period={billPeriod}
            cyclesPerYear={cycles_per_year}
            cycleCount={estimate_cycle_count}
          />
          {bills_percent_of_income != null && (
            <div className="text-xs text-slate-400">
              That's about {bills_percent_of_income}% of your estimated monthly income.
            </div>
          )}
        </div>
      )}

      {income_sources.length > 0 && (
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium flex items-center gap-1">
                Income
                <InfoTooltip text="Same idea as Recurring bills: the tabs show real amounts you've actually marked received, attributed to the cycle's own pay date. The estimate line below is the projection." />
              </div>
              <div className="text-xs text-slate-400">Actual amounts received, by source.</div>
            </div>
            <PeriodTabs value={incomePeriod} onChange={setIncomePeriod} cycleLabel={cycleLabel} />
          </div>

          {incomePieSlices.length > 0 && (
            <CategoryPieChart slices={incomePieSlices} ariaLabel="Income by source" />
          )}

          <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 font-medium text-sm">
            <span>Total ({PERIOD_TOTAL_LABEL[incomePeriod]})</span>
            <span>{fmt(incomePeriodTotal)}</span>
          </div>
          <EstimateLine
            label="Estimated income"
            perCycle={estimated_income_per_cycle}
            period={incomePeriod}
            cyclesPerYear={cycles_per_year}
            cycleCount={estimate_cycle_count}
          />
        </div>
      )}

      {cards_owed.length > 1 && (
        <div className="rounded-xl border border-slate-200 p-4 space-y-2">
          <div className="text-sm font-medium flex items-center gap-1">
            Credit cards
            <InfoTooltip text="'Paid off by' first reads your own plan: if you've already entered future payments against a card, it finds the exact cycle where they bring the balance to zero. If you haven't planned that far ahead, it estimates from your average payment pace instead." />
          </div>
          <div className="divide-y divide-slate-100">
            {cards_owed.map((c) => (
              <div key={c.bill_source_id} className="py-1.5 text-sm">
                <div className="flex justify-between items-baseline">
                  <span className="flex items-center gap-1.5">
                    <BillCategoryIcon category="Credit Card" className="w-3.5 h-3.5 shrink-0" />
                    {c.name}
                    {c.issuer && <span className="text-slate-400"> · {c.issuer}</span>}
                  </span>
                  <span className={c.owed_balance > 0 ? "text-red-600 font-medium" : "text-slate-400"}>
                    {fmt(c.owed_balance)}
                  </span>
                </div>
                {c.owed_balance > 0 && c.projected_payoff_date && (
                  <div className="text-xs text-slate-400">Paid off by {c.projected_payoff_date}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {bills_due_soon.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/30 p-4 space-y-2">
          <div className="text-sm font-medium text-red-600 flex items-center gap-1">
            Bills due soon
            <InfoTooltip text="Due dates use each bill's own 'due day' if you've set one (Setup > Bills); otherwise the cycle's own pay date. Overdue means the due date has passed with no payment recorded and it isn't marked paid." />
          </div>
          <div className="divide-y divide-red-100">
            {bills_due_soon.map((b) => (
              <div key={`${b.bill_source_id}-${b.due_date}`} className="flex justify-between items-baseline py-1.5 text-sm">
                <div className="flex items-start gap-1.5">
                  <BillCategoryIcon category={b.category} className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">{b.name}</span>
                    {b.is_overdue && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide font-semibold text-white bg-red-600 rounded-full px-1.5 py-0.5">
                        Overdue
                      </span>
                    )}
                    <span className="text-slate-400"> · due {b.is_overdue ? "" : "by "}{b.due_date}</span>
                  </div>
                </div>
                <span className="text-red-600 font-medium">{fmt(b.amount_due)}</span>
              </div>
            ))}
          </div>
          {current_period_id && (
            <Link href={`/period/${current_period_id}`} className="text-xs text-emerald-700 hover:underline">
              View current cycle →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
