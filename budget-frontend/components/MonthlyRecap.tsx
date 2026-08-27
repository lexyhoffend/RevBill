"use client";

import { useEffect, useState } from "react";
import { DashboardSummary } from "@/lib/api";
import BillCategoryIcon from "@/components/BillCategoryIcon";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

function monthLabel() {
  return new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** A dismissible "your month in review" card built entirely from data the
 * dashboard already fetches -- no separate endpoint. Dismissal is
 * per-calendar-month (via localStorage), so it naturally reappears once a
 * new month starts. */
export default function MonthlyRecap({ summary }: { summary: DashboardSummary }) {
  const [dismissed, setDismissed] = useState(true);
  const key = `revbill-recap-dismissed-${monthKey()}`;

  useEffect(() => {
    setDismissed(localStorage.getItem(key) === "1");
  }, [key]);

  if (summary.monthly_bills_total <= 0 || dismissed) return null;

  const topCategory = summary.bill_categories[0];
  const noCardDebt = summary.total_owed === 0;

  function dismiss() {
    localStorage.setItem(key, "1");
    setDismissed(true);
  }

  return (
    <div className="relative rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
      >
        ✕
      </button>
      <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Your {monthLabel()} recap</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs text-slate-400">Paid this month</div>
          <div className="font-semibold">{fmt(summary.monthly_bills_total)}</div>
        </div>
        {topCategory && (
          <div>
            <div className="text-xs text-slate-400">Top category</div>
            <div className="font-semibold flex items-center gap-1.5">
              <BillCategoryIcon category={topCategory.category} className="w-4 h-4 shrink-0" />
              {topCategory.category}
            </div>
          </div>
        )}
        <div>
          <div className="text-xs text-slate-400">Total saved</div>
          <div className="font-semibold text-emerald-700 dark:text-emerald-400">
            {fmt(summary.total_saved_all_buckets)}
          </div>
        </div>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {noCardDebt
          ? "No credit card debt right now -- nice work."
          : summary.bills_percent_of_income != null
          ? `Bills are about ${summary.bills_percent_of_income}% of your estimated income this month.`
          : "Keep it up!"}
      </div>
    </div>
  );
}
