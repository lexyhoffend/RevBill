"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PayCycleMode, listBillSources, listIncomeSources, setPayCycleMode } from "@/lib/api";
import RequireAuth, { useAuth } from "@/components/RequireAuth";
import AccountNav from "@/components/AccountNav";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const MODE_OPTIONS: { value: PayCycleMode; label: string; description: string }[] = [
  { value: "monthly", label: "Monthly", description: "One cycle per month, covering the month before a pay date you choose (e.g. paid on the 15th)." },
  { value: "biweekly", label: "Bi-weekly", description: "A new cycle every 2 weeks, each one ending on a pay date you choose." },
  { value: "weekly", label: "Weekly", description: "A new cycle every week, each one ending on a pay date you choose." },
  { value: "custom", label: "Custom", description: "You'll create each cycle yourself, whenever you want." },
];

export default function SetupCyclePage() {
  return (
    <RequireAuth>
      <SetupCycleForm />
    </RequireAuth>
  );
}

function SetupCycleForm() {
  const state = useAuth();

  if (state.status !== "authed") {
    return <main className="max-w-2xl mx-auto p-6 text-sm text-slate-400">Loading…</main>;
  }

  return <SetupCycleFields isEditing={state.user.pay_cycle_mode !== null} initial={state.user} />;
}

function SetupCycleFields({
  isEditing,
  initial,
}: {
  isEditing: boolean;
  initial: { pay_cycle_mode: PayCycleMode | null; pay_cycle_anchor_day: number | null; pay_cycle_anchor_date: string | null };
}) {
  const router = useRouter();
  const [mode, setMode] = useState<PayCycleMode>(initial.pay_cycle_mode ?? "biweekly");
  const [anchorDay, setAnchorDay] = useState(String(initial.pay_cycle_anchor_day ?? 15));
  const [anchorDate, setAnchorDate] = useState(initial.pay_cycle_anchor_date ?? todayIso());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await setPayCycleMode({
        mode,
        anchor_day: mode === "monthly" ? Number(anchorDay) : null,
        anchor_date: mode === "weekly" || mode === "biweekly" ? anchorDate : null,
      });
      if (isEditing) {
        router.push("/");
        return;
      }
      const [income, bills] = await Promise.all([listIncomeSources(), listBillSources()]);
      router.push(income.length === 0 && bills.length === 0 ? "/sources" : "/");
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-6">
        {isEditing ? (
          <Link href="/" className="text-sm text-slate-500 hover:underline shrink-0">
            ← Back
          </Link>
        ) : (
          <h1 className="text-2xl font-bold shrink-0">
            Rev<span className="text-emerald-700 dark:text-emerald-400">Bill</span>
          </h1>
        )}
        <AccountNav />
      </div>
      <div>
        <p className="text-sm text-slate-400 mt-1">
          {isEditing ? "Update how you manage your income and bills." : "How do you want to manage your income and bills?"}
        </p>
        {isEditing && (
          <p className="text-xs text-slate-400 mt-1">
            Cycles you haven't touched yet will be regenerated with the corrected schedule. Any cycle with real
            activity on it is left as-is.
          </p>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          {MODE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer ${
                mode === opt.value
                  ? "border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={opt.value}
                checked={mode === opt.value}
                onChange={() => setMode(opt.value)}
                className="mt-1"
              />
              <div>
                <div className="font-medium">{opt.label}</div>
                <div className="text-sm text-slate-400">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>

        {mode === "monthly" && (
          <label className="flex items-center gap-2 text-sm">
            Day of the month you get paid
            <input
              value={anchorDay}
              onChange={(e) => setAnchorDay(e.target.value)}
              type="number"
              min={1}
              max={31}
              className="w-20 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
            />
          </label>
        )}

        {(mode === "weekly" || mode === "biweekly") && (
          <label className="flex items-center gap-2 text-sm">
            A recent or upcoming pay date
            <input
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              type="date"
              className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60"
        >
          {submitting ? "Saving…" : isEditing ? "Save changes" : "Continue"}
        </button>
      </form>
    </main>
  );
}
