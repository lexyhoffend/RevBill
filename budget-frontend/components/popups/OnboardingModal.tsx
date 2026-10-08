"use client";

import { useState } from "react";
import { OnboardingData, completeOnboarding } from "@/lib/api";
import { todayIso } from "@/lib/periodUtils";
import Modal from "@/components/popups/Modal";
import { money } from "@/components/plan/format";
import { SKIP_WELCOME_KEY } from "@/components/popups/WelcomeModal";

type Schedule = OnboardingData["schedule"];
type BillDraft = { name: string; amount: string; dueDay: string; category: string };

const SCHEDULES: { value: Schedule; label: string; hint: string }[] = [
  { value: "weekly", label: "Every week", hint: "Same day each week" },
  { value: "biweekly", label: "Every 2 weeks", hint: "The most common schedule" },
  { value: "semimonthly", label: "Twice a month", hint: "e.g. the 15th and the last day" },
  { value: "monthly", label: "Once a month", hint: "Same date each month" },
];

const PRESETS: { name: string; category: string }[] = [
  { name: "Rent", category: "Rent" },
  { name: "Car", category: "Car Payment" },
  { name: "Phone", category: "Cell Phone" },
  { name: "Utilities", category: "Energy" },
];

const EMPTY_BILL: BillDraft = { name: "", amount: "", dueDay: "", category: "Other" };

// Paychecks per month, to compare take-home pay with (monthly) bills.
const PAYCHECKS_PER_MONTH: Record<Schedule, number> = { weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1 };

function nextFriday(): string {
  const d = new Date();
  d.setDate(d.getDate() + (((5 - d.getDay() + 7) % 7) || 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** First visit only (no pay schedule yet): the key information -- pay
 * schedule and income, then the 3 biggest bills -- then "Finish Managing"
 * opens Setup to fill in the rest. */
export default function OnboardingModal() {
  const [step, setStep] = useState(1);
  const [takeHome, setTakeHome] = useState("");
  const [schedule, setSchedule] = useState<Schedule>("biweekly");
  const [nextPayday, setNextPayday] = useState(nextFriday());
  const [secondDay, setSecondDay] = useState("31");
  const [bills, setBills] = useState<BillDraft[]>([{ ...EMPTY_BILL }, { ...EMPTY_BILL }, { ...EMPTY_BILL }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedBills, setSavedBills] = useState<{ name: string; amount: number }[]>([]);

  function setBill(i: number, patch: Partial<BillDraft>) {
    setBills((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }

  // Functional update so quick taps on several presets each land in their own row.
  function addPreset(preset: { name: string; category: string }) {
    setBills((bs) => {
      const i = bs.findIndex((b) => !b.name.trim());
      return i === -1 ? [...bs, { ...EMPTY_BILL, ...preset }] : bs.map((b, j) => (j === i ? { ...b, ...preset } : b));
    });
  }

  function payContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!(Number(takeHome) > 0)) {
      setError("Enter what you usually take home per paycheck.");
      return;
    }
    if (!nextPayday) {
      setError("Pick your next payday.");
      return;
    }
    if (schedule === "semimonthly" && Number(secondDay) === Number(nextPayday.slice(8, 10))) {
      setError("Your two pay days need to be different.");
      return;
    }
    setStep(2);
  }

  async function saveSetup(includeBills: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      const kept = includeBills
        ? bills.filter((b) => b.name.trim() && Number(b.amount) > 0).map((b) => ({ name: b.name.trim(), amount: Number(b.amount) }))
        : [];
      await completeOnboarding({
        take_home: Number(takeHome),
        schedule,
        next_payday: nextPayday,
        second_pay_day: schedule === "semimonthly" ? Number(secondDay) : null,
        bills: includeBills
          ? bills
              .filter((b) => b.name.trim() && Number(b.amount) > 0)
              .map((b) => ({ name: b.name.trim(), amount: Number(b.amount), due_day: Number(b.dueDay) || null, category: b.category }))
          : [],
      });
      setSavedBills(kept);
      setSubmitting(false);
      setStep(3);
    } catch (err) {
      setError(String(err).replace(/^Error:\s*/, ""));
      setSubmitting(false);
    }
  }

  function finishManaging() {
    // This visit already covered the first cycle, so the "Welcome back"
    // pop-up waits for their next visit. Full navigation so every page
    // re-reads the account (pay schedule now set).
    try {
      sessionStorage.setItem(SKIP_WELCOME_KEY, "1");
    } catch {
      // storage unavailable -- they may see the welcome once, which is fine
    }
    window.location.href = "/sources";
  }

  return (
    <Modal labelledBy="onboarding-title">
      <div className="flex items-center justify-between">
        <h1 id="onboarding-title" className="text-xl font-bold">
          Welcome to Rev<span className="text-sky-700">Bill</span>
        </h1>
        {step < 3 && <span className="text-xs text-slate-400">Step {step} of 2</span>}
      </div>

      {error && <p className="text-amber-800 text-sm">{error}</p>}

      {step === 1 && (
        <form onSubmit={payContinue} className="space-y-5">
          <h2 className="text-lg font-semibold text-slate-900">Let&apos;s put the money you EARN to work. First, your pay:</h2>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-800">What do you usually take home per paycheck?</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">$</span>
              <input
                autoFocus
                type="number"
                step="0.01"
                min={0}
                value={takeHome}
                onChange={(e) => setTakeHome(e.target.value)}
                placeholder="2,000"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white text-lg"
              />
            </div>
            <span className="text-xs text-slate-500">After taxes, what actually lands in your account.</span>
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-800 mb-1">How often do you get paid?</legend>
            {SCHEDULES.map((s) => (
              <label
                key={s.value}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer ${
                  schedule === s.value ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"
                }`}
              >
                <input type="radio" name="schedule" checked={schedule === s.value} onChange={() => setSchedule(s.value)} />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{s.label}</span>
                  <span className="block text-xs text-slate-500">{s.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-800">When is your next payday?</span>
            <input
              type="date"
              min={todayIso()}
              value={nextPayday}
              onChange={(e) => setNextPayday(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
            />
          </label>
          {schedule === "semimonthly" && (
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-800">What&apos;s your other pay day each month?</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={secondDay}
                  onChange={(e) => setSecondDay(e.target.value)}
                  className="w-20 border border-slate-300 rounded-lg px-3 py-2 bg-white"
                />
                <span className="text-xs text-slate-500">31 means the last day of the month</span>
              </div>
            </label>
          )}
          <button type="submit" className="w-full px-4 py-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-medium">
            Continue
          </button>
        </form>
      )}

      {step === 2 && (
        <section className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Your 3 biggest bills</h2>
            <p className="text-sm text-slate-600">You can add the rest later.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => addPreset(p)}
                className="text-sm px-3 py-1.5 rounded-full border border-slate-300 bg-white hover:border-sky-500 hover:bg-sky-50"
              >
                + {p.name}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {bills.map((b, i) => (
              <div key={i} className="grid grid-cols-[1fr_6.5rem_4.5rem] gap-2">
                <input
                  value={b.name}
                  onChange={(e) => setBill(i, { name: e.target.value })}
                  placeholder="Bill name"
                  aria-label={`Bill ${i + 1} name`}
                  className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm min-w-0"
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={b.amount}
                  onChange={(e) => setBill(i, { amount: e.target.value })}
                  placeholder="$ Amount"
                  aria-label={`Bill ${i + 1} amount`}
                  className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
                />
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={b.dueDay}
                  onChange={(e) => setBill(i, { dueDay: e.target.value })}
                  placeholder="Due"
                  aria-label={`Bill ${i + 1} due day of month`}
                  className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
                />
              </div>
            ))}
            <p className="text-xs text-slate-500">Due = day of the month it&apos;s due (1-31).</p>
          </div>
          <button
            onClick={() => saveSetup(true)}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-medium disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Continue"}
          </button>
          <button onClick={() => saveSetup(false)} disabled={submitting} className="w-full text-sm text-slate-500 hover:underline">
            Skip for now
          </button>
        </section>
      )}

      {step === 3 && (
        <EarnedVsBills
          earned={Math.round(Number(takeHome) * PAYCHECKS_PER_MONTH[schedule] * 100) / 100}
          bills={savedBills}
          onFinish={finishManaging}
        />
      )}
    </Modal>
  );
}

/** The payoff of setup: what they EARN in a month vs. what their bills take,
 * and what's left -- framed as money still to manage, never as "short". */
function EarnedVsBills({
  earned,
  bills,
  onFinish,
}: {
  earned: number;
  bills: { name: string; amount: number }[];
  onFinish: () => void;
}) {
  const billsTotal = bills.reduce((sum, b) => sum + b.amount, 0);
  const left = earned - billsTotal;
  const scale = Math.max(earned, billsTotal) || 1;
  const pct = (n: number) => `${Math.max((n / scale) * 100, n > 0 ? 2 : 0)}%`;

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Here&apos;s your month at a glance</h2>
        <p className="text-xs text-slate-500">Based on your take-home pay and the bills you just added.</p>
      </div>

      <div className="space-y-3" role="img" aria-label={`Earned ${money(earned)}, bills ${money(billsTotal)}, left ${money(left)}`}>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-slate-800">You EARN</span>
            <span className="font-semibold text-slate-900">{money(earned)}</span>
          </div>
          <div className="h-4 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-sky-700" style={{ width: pct(earned) }} />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-slate-800">Bills</span>
            <span className="font-semibold text-slate-900">{money(billsTotal)}</span>
          </div>
          <div className="h-4 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-slate-500" style={{ width: pct(billsTotal) }} />
          </div>
          {bills.length > 0 && (
            <div className="text-xs text-slate-500">{bills.map((b) => `${b.name} ${money(b.amount)}`).join(" · ")}</div>
          )}
        </div>
      </div>

      {left >= 0 ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center space-y-1">
          <div className="text-sm text-green-800">✓ Left after bills</div>
          <div className="text-3xl font-bold text-slate-900">{money(left)}</div>
          <div className="text-sm text-slate-700">That&apos;s more money to manage. Let&apos;s decide how you&apos;ll use it.</div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center space-y-1">
          <div className="text-sm text-amber-900">⚠ Still to plan</div>
          <div className="text-3xl font-bold text-slate-900">{money(-left)}</div>
          <div className="text-sm text-slate-700">Let&apos;s finish setting up and build a plan for every bill.</div>
        </div>
      )}

      <button onClick={onFinish} className="w-full px-4 py-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-medium">
        Finish Managing
      </button>
    </section>
  );
}
