"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PayPeriodSummary, listPeriodsSummary } from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";
import RequirePayCycle from "@/components/RequirePayCycle";
import AccountNav from "@/components/AccountNav";
import EmptyState from "@/components/EmptyState";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function HistoryPage() {
  const [periods, setPeriods] = useState<PayPeriodSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPeriodsSummary()
      .then(setPeriods)
      .catch((e) => setError(String(e)));
  }, []);

  const sorted = [...periods].reverse();

  return (
    <RequireAuth>
      <RequirePayCycle>
      <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-6">
        <Link href="/" className="text-sm text-slate-500 hover:underline shrink-0">
          ← Back
        </Link>
        <AccountNav />
      </div>
      <h1 className="text-2xl font-bold">History</h1>
      {error && <p className="text-amber-700 text-sm">{error}</p>}

      {sorted.length === 0 ? (
        <EmptyState illustration="calendar" title="No pay periods yet" subtitle="Once you've completed a cycle or two, they'll show up here." />
      ) : (
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <th className="py-2 px-4 font-medium">Period</th>
              <th className="py-2 px-4 font-medium">Dates</th>
              <th className="py-2 px-4 font-medium text-right">Income</th>
              <th className="py-2 px-4 font-medium text-right">Paid</th>
              <th className="py-2 px-4 font-medium text-right">Left</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="py-2 px-4">
                  <Link href={`/period/${p.id}`} className="font-medium hover:underline">
                    {p.label}
                  </Link>
                </td>
                <td className="py-2 px-4 text-slate-400 whitespace-nowrap">
                  {p.start_date} – {p.end_date}
                </td>
                <td className="py-2 px-4 text-right text-sky-700 dark:text-sky-400">
                  +{fmt(p.total_income)}
                </td>
                <td className="py-2 px-4 text-right text-amber-700 dark:text-amber-400">-{fmt(p.total_bills_paid)}</td>
                <td
                  className={`py-2 px-4 text-right font-medium ${
                    p.left_over < 0 ? "text-amber-700 dark:text-amber-400" : "text-sky-700 dark:text-sky-400"
                  }`}
                >
                  {fmt(p.left_over)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      </main>
      </RequirePayCycle>
    </RequireAuth>
  );
}
