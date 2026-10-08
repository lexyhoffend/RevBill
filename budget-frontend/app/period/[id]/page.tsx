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
import DashboardHeader from "@/components/DashboardHeader";
import InfoTooltip from "@/components/InfoTooltip";
import BillMonthCalendar from "@/components/BillMonthCalendar";

export default function PeriodPage() {
  const params = useParams<{ id: string }>();
  const periodId = Number(params.id);

  const [period, setPeriod] = useState<PayPeriodDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  // Apply a change on screen immediately -- checkbox and the summaries at the
  // top -- then save in the background and reconcile with the server. A
  // failed save shows an error and reloads the real numbers.
  function applyLocally(patch: (p: PayPeriodDetail) => PayPeriodDetail) {
    setPeriod((p) => {
      if (!p) return p;
      const next = patch(p);
      const totalIncome = next.income_entries.reduce((s, e) => s + e.actual_amount, 0);
      const totalBills = next.bill_entries.reduce((s, e) => s + e.actual_amount, 0);
      return {
        ...next,
        total_income: totalIncome,
        total_bills_paid: totalBills,
        left_over: totalIncome - totalBills - next.total_saved,
      };
    });
  }

  async function saveInBackground(save: () => Promise<unknown>) {
    latestRequest.current++; // any reload already in flight is now stale
    try {
      await save();
      setSaveError(null);
    } catch (e) {
      setSaveError(`Couldn't save that change: ${String(e).replace(/^Error:\s*/, "")}`);
    }
    refresh();
  }

  return (
    <RequireAuth>
      <RequirePayCycle>
      {error ? (
        <main className="max-w-2xl mx-auto p-6 text-amber-700 text-sm">{error}</main>
      ) : !period ? (
        <main className="max-w-2xl mx-auto p-6">Loading…</main>
      ) : (
        <main className="max-w-4xl mx-auto p-6 space-y-6">
          <DashboardHeader active="/periods" />
          {saveError && (
            <p role="alert" className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠ {saveError}
            </p>
          )}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{period.label}</h1>
            {(period.pay_date ?? period.end_date) <= period.start_date && (
              <Link
                href={`/manage/${period.id}`}
                className="text-sm px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
              >
                {period.managed_at ? "✓ Plan: every dollar has a job" : "Give every dollar a job →"}
              </Link>
            )}
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
                <h2 className="font-semibold text-sky-700 dark:text-sky-400 flex items-center gap-1">
                  Income
                  <InfoTooltip text="Check a source off once you've been paid -- it auto-fills the expected amount, but you can still edit the number afterward without unchecking it." />
                </h2>
                <div>
                  {period.income_entries.map((entry) => (
                    <IncomeLineRow
                      key={entry.id}
                      entry={entry}
                      onSave={async (actual, isReceived) => {
                        applyLocally((p) => ({
                          ...p,
                          income_entries: p.income_entries.map((e) =>
                            e.id === entry.id
                              ? { ...e, actual_amount: actual, ...(isReceived !== undefined ? { is_received: isReceived } : {}) }
                              : e
                          ),
                        }));
                        await saveInBackground(() =>
                          updateIncomeEntry(entry.id, {
                            actual_amount: actual,
                            ...(isReceived !== undefined ? { is_received: isReceived } : {}),
                          })
                        );
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
                <h2 className="font-semibold text-slate-800 mb-2 flex items-center gap-1">
                  Bills
                  <InfoTooltip text="The checkbox is yours to control -- checking it marks the bill paid and fills in the target amount, but editing the amount afterward won't uncheck it. 'Due'/'Overdue' shows this bill's own due date if you've set one in Setup." />
                </h2>
                <div>
                  {period.bill_entries.map((entry) => (
                    <BillLineRow
                      key={entry.id}
                      entry={entry}
                      onSave={async (actual, isPaid) => {
                        applyLocally((p) => ({
                          ...p,
                          bill_entries: p.bill_entries.map((e) =>
                            e.id === entry.id
                              ? { ...e, actual_amount: actual, ...(isPaid !== undefined ? { is_paid: isPaid } : {}) }
                              : e
                          ),
                        }));
                        await saveInBackground(() =>
                          updateBillEntry(entry.id, {
                            actual_amount: actual,
                            ...(isPaid !== undefined ? { is_paid: isPaid } : {}),
                          })
                        );
                      }}
                    />
                  ))}
                </div>
              </section>
            </div>

            <div className="order-1 lg:order-2 lg:sticky lg:top-6">
              <BillMonthCalendar key={period.id} initialDate={period.pay_date ?? period.end_date} />
            </div>
          </div>
        </main>
      )}
      </RequirePayCycle>
    </RequireAuth>
  );
}
