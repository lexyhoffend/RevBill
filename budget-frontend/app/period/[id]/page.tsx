"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  PayPeriodDetail,
  addOneTimeIncome,
  getPeriod,
  updateBillEntry,
  updateIncomeEntry,
  BILL_CATEGORY_GROUPS,
  BILL_GROUP_ORDER,
} from "@/lib/api";
import SummaryPanel from "@/components/SummaryPanel";
import CycleBreakdownBar from "@/components/CycleBreakdownBar";
import OweBalancesPanel from "@/components/OweBalancesPanel";
import IncomeLineRow from "@/components/IncomeLineRow";
import BillLineRow from "@/components/BillLineRow";
import AddOneTimeIncome from "@/components/AddOneTimeIncome";
import SavingsSection from "@/components/SavingsSection";
import RequireAuth from "@/components/RequireAuth";
import RequirePayCycle from "@/components/RequirePayCycle";
import AccountNav from "@/components/AccountNav";
import InfoTooltip from "@/components/InfoTooltip";
import BillMonthCalendar from "@/components/BillMonthCalendar";

export default function PeriodPage() {
  const params = useParams<{ id: string }>();
  const periodId = Number(params.id);

  const [period, setPeriod] = useState<PayPeriodDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Saves made close together (e.g. typing an amount, then checking "paid")
  // each trigger a reload, and those can come back out of order. Only the
  // newest reload is applied, so an older snapshot never overwrites newer
  // state -- that's what made a checked box appear to uncheck itself.
  const latestRequest = useRef(0);
  const refresh = useCallback(() => {
    if (!periodId) return;
    const requestId = ++latestRequest.current;
    getPeriod(periodId)
      .then((data) => {
        if (requestId === latestRequest.current) setPeriod(data);
      })
      .catch((e) => {
        if (requestId === latestRequest.current) setError(String(e));
      });
  }, [periodId]);

  useEffect(refresh, [refresh]);

  return (
    <RequireAuth>
      <RequirePayCycle>
      {error ? (
        <main className="max-w-2xl mx-auto p-6 text-red-600 text-sm">{error}</main>
      ) : !period ? (
        <main className="max-w-2xl mx-auto p-6">Loading…</main>
      ) : (
        <main className="max-w-4xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between gap-6">
            <Link href="/periods" className="text-sm text-slate-500 hover:underline shrink-0">
              ← Back
            </Link>
            <AccountNav />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{period.label}</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">
            <div className="space-y-6 min-w-0 order-2 lg:order-1">
              {period.total_income > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                  <div className="text-sm font-medium flex items-center gap-1">
                    This cycle
                    <InfoTooltip text="How this cycle's income has been divided up so far: bills paid (by category), money moved to savings, and what's left. Only counts what you've actually marked paid/received in this specific cycle." />
                  </div>
                  <CycleBreakdownBar
                    income={period.total_income}
                    billGroups={BILL_GROUP_ORDER.map((label) => ({
                      label,
                      amount: period.bill_entries
                        .filter((e) => (BILL_CATEGORY_GROUPS[e.category] ?? "Other bills") === label)
                        .reduce((sum, e) => sum + e.actual_amount, 0),
                    }))}
                    saved={period.total_saved}
                    leftOver={period.left_over}
                  />
                </div>
              )}

              <SummaryPanel
                totalIncome={period.total_income}
                totalBillsPaid={period.total_bills_paid}
                totalSaved={period.total_saved}
                leftOver={period.left_over}
              />

              <OweBalancesPanel billEntries={period.bill_entries} />

              <section className="space-y-2">
                <h2 className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  Income
                  <InfoTooltip text="Check a source off once you've been paid -- it auto-fills the expected amount, but you can still edit the number afterward without unchecking it." />
                </h2>
                <div>
                  {period.income_entries.map((entry) => (
                    <IncomeLineRow
                      key={entry.id}
                      entry={entry}
                      onSave={async (actual, isReceived) => {
                        await updateIncomeEntry(entry.id, {
                          actual_amount: actual,
                          ...(isReceived !== undefined ? { is_received: isReceived } : {}),
                        });
                        refresh();
                      }}
                    />
                  ))}
                </div>
                <AddOneTimeIncome
                  onAdd={async (label, amount) => {
                    await addOneTimeIncome(periodId, { label, amount });
                    refresh();
                  }}
                />
              </section>

              <SavingsSection
                periodId={periodId}
                entries={period.savings_entries}
                leftOver={period.left_over}
                onAdded={refresh}
              />

              <section>
                <h2 className="font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                  Bills
                  <InfoTooltip text="The checkbox is yours to control -- checking it marks the bill paid and fills in the target amount, but editing the amount afterward won't uncheck it. 'Due'/'Overdue' shows this bill's own due date if you've set one in Setup." />
                </h2>
                <div>
                  {period.bill_entries.map((entry) => (
                    <BillLineRow
                      key={entry.id}
                      entry={entry}
                      onSave={async (actual, isPaid) => {
                        await updateBillEntry(entry.id, {
                          actual_amount: actual,
                          ...(isPaid !== undefined ? { is_paid: isPaid } : {}),
                        });
                        refresh();
                      }}
                    />
                  ))}
                </div>
              </section>
            </div>

            <div className="order-1 lg:order-2 lg:sticky lg:top-6">
              <BillMonthCalendar key={period.id} initialDate={period.end_date} />
            </div>
          </div>
        </main>
      )}
      </RequirePayCycle>
    </RequireAuth>
  );
}
