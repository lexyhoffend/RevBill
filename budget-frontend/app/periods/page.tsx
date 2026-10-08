"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PayPeriod, deletePeriod, generateNextPeriod, listPeriods, createPeriod } from "@/lib/api";
import { findCurrentPeriod, findNextPeriod, todayIso } from "@/lib/periodUtils";
import RequireAuth, { useAuth } from "@/components/RequireAuth";
import RequirePayCycle from "@/components/RequirePayCycle";
import DashboardHeader from "@/components/DashboardHeader";
import { useConfirm } from "@/components/ConfirmProvider";
import InfoTooltip from "@/components/InfoTooltip";
import EmptyState from "@/components/EmptyState";

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Grouped by the period's own pay date (end_date) -- plain string slicing, not
// Date parsing, to sidestep any local-timezone shift on YYYY-MM-DD strings.
function yearOf(p: PayPeriod): number {
  return Number(p.end_date.slice(0, 4));
}

function quarterOf(p: PayPeriod): number {
  return Math.ceil(Number(p.end_date.slice(5, 7)) / 3);
}

export default function PeriodsPage() {
  return (
    <RequireAuth>
      <RequirePayCycle>
        <PeriodsContent />
      </RequirePayCycle>
    </RequireAuth>
  );
}

function PeriodRow({
  p,
  badge,
  onDelete,
}: {
  p: PayPeriod;
  badge?: "current" | "next";
  onDelete: (p: PayPeriod) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors ${
        badge === "current"
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20"
          : badge === "next"
          ? "border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20"
          : "border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
      }`}
    >
      <Link href={`/period/${p.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{p.label}</span>
          {badge === "current" && (
            <span className="text-[10px] uppercase tracking-wide font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full px-2 py-0.5">
              Current
            </span>
          )}
          {badge === "next" && (
            <span className="text-[10px] uppercase tracking-wide font-semibold text-blue-700 bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 rounded-full px-2 py-0.5">
              Next
            </span>
          )}
        </div>
        <div className="text-xs text-slate-400">
          {p.start_date} – {p.end_date}
        </div>
      </Link>
      <button onClick={() => onDelete(p)} className="text-xs text-red-500 hover:underline shrink-0">
        Delete
      </button>
    </div>
  );
}

function YearSections({
  sectionKey,
  periods,
  expandedGroups,
  ascending,
  onToggleYear,
  onDelete,
}: {
  sectionKey: string;
  periods: PayPeriod[];
  expandedGroups: Set<string>;
  ascending?: boolean;
  onToggleYear: (groupKey: string) => void;
  onDelete: (p: PayPeriod) => void;
}) {
  const yearSort = ascending ? (a: number, b: number) => a - b : (a: number, b: number) => b - a;
  const quarters = ascending ? [1, 2, 3, 4] : [4, 3, 2, 1];
  const years = Array.from(new Set(periods.map(yearOf))).sort(yearSort);
  return (
    <div className="space-y-3">
      {years.map((year) => {
        const yearPeriods = periods
          .filter((p) => yearOf(p) === year)
          .sort((a, b) => (ascending ? a.start_date.localeCompare(b.start_date) : b.start_date.localeCompare(a.start_date)));
        const groupKey = `${sectionKey}-${year}`;
        const expanded = expandedGroups.has(groupKey);
        return (
          <div key={year} className="space-y-2">
            <button
              onClick={() => onToggleYear(groupKey)}
              className="w-full flex items-center justify-between text-left py-1.5 border-b border-slate-200 dark:border-slate-700"
            >
              <span className="font-semibold">{year}</span>
              <span className="text-xs text-slate-400">
                {yearPeriods.length} cycle{yearPeriods.length === 1 ? "" : "s"} {expanded ? "▾" : "▸"}
              </span>
            </button>
            {expanded && (
              <div className="space-y-4">
                {quarters.map((q) => {
                  const quarterPeriods = yearPeriods.filter((p) => quarterOf(p) === q);
                  if (quarterPeriods.length === 0) return null;
                  return (
                    <div key={q} className="space-y-2">
                      <div className="text-xs uppercase tracking-wide font-semibold text-slate-400">Q{q}</div>
                      {quarterPeriods.map((p) => (
                        <PeriodRow key={p.id} p={p} onDelete={onDelete} />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PeriodsContent() {
  const { confirm } = useConfirm();
  const authState = useAuth();
  const mode = authState.status === "authed" ? authState.user.pay_cycle_mode : null;

  const [periods, setPeriods] = useState<PayPeriod[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expansionInitialized, setExpansionInitialized] = useState(false);

  function refresh() {
    listPeriods()
      .then(setPeriods)
      .catch((e) => setError(String(e)));
  }

  useEffect(refresh, []);

  const current = findCurrentPeriod(periods);
  const next = findNextPeriod(periods, current);

  // Auto-expand the year containing the current period, in both the Upcoming
  // and Past sections independently, and only once -- later refreshes (e.g.
  // after a delete) shouldn't re-collapse a group the user toggled themselves.
  useEffect(() => {
    if (expansionInitialized || periods.length === 0) return;
    const anchor = current ?? periods[periods.length - 1];
    const anchorYear = yearOf(anchor);
    setExpandedGroups(new Set([`future-${anchorYear}`, `past-${anchorYear}`]));
    setExpansionInitialized(true);
  }, [periods, current, expansionInitialized]);

  function toggleYear(groupKey: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  async function handleCreatePeriod() {
    setCreating(true);
    try {
      const start = todayIso();
      const end = addDaysIso(start, 13);
      const label = `Payment Cycle ${new Date(start).toLocaleDateString()}`;
      await createPeriod({ label, start_date: start, end_date: end });
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleAddNextPeriod() {
    setCreating(true);
    try {
      await generateNextPeriod();
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleDeletePeriod(p: PayPeriod) {
    const ok = await confirm(
      `Delete "${p.label}" (${p.start_date} – ${p.end_date})? This also removes its income, bill, and savings entries.`,
      { destructive: true }
    );
    if (!ok) return;
    try {
      await deletePeriod(p.id);
      refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  const others = periods.filter((p) => p.id !== current?.id && p.id !== next?.id);
  const past = current ? others.filter((p) => p.start_date < current.start_date) : others;
  const future = current ? others.filter((p) => p.start_date > current.start_date) : [];

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <DashboardHeader active="/periods" />

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold flex items-center gap-1">
          Pay periods
          <InfoTooltip text="Current is the most recent cycle whose pay date has already arrived -- a cycle doesn't become current until its own pay date hits. Next is simply the one right after it." />
        </h2>
        {mode && (
          <div className="flex items-center gap-3">
            {mode !== "custom" && (
              <span className="text-xs text-slate-400 hidden sm:inline">Auto-created — managed as {mode}</span>
            )}
            <button
              onClick={mode === "custom" ? handleCreatePeriod : handleAddNextPeriod}
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60 shrink-0"
            >
              {creating ? "Creating…" : mode === "custom" ? "+ New period" : "+ Add one more cycle"}
            </button>
          </div>
        )}
      </div>

      {periods.length === 0 && (
        <EmptyState
          illustration="calendar"
          title="No pay periods yet"
          subtitle="Set up your income and bills first, then create your first period."
          action={
            <Link href="/sources" className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline">
              Set up income and bills →
            </Link>
          }
        />
      )}

      {(current || next) && (
        <div className="space-y-2">
          {current && <PeriodRow p={current} badge="current" onDelete={handleDeletePeriod} />}
          {next && <PeriodRow p={next} badge="next" onDelete={handleDeletePeriod} />}
        </div>
      )}

      {future.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-400">Upcoming</h3>
          <YearSections
            sectionKey="future"
            periods={future}
            expandedGroups={expandedGroups}
            ascending
            onToggleYear={toggleYear}
            onDelete={handleDeletePeriod}
          />
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs uppercase tracking-wide font-semibold text-slate-400">Past</h3>
          <YearSections
            sectionKey="past"
            periods={past}
            expandedGroups={expandedGroups}
            onToggleYear={toggleYear}
            onDelete={handleDeletePeriod}
          />
        </div>
      )}
    </main>
  );
}
