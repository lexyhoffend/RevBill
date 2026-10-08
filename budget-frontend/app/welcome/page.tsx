"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingData, completeOnboarding } from "@/lib/api";
import RequireAuth, { useAuth } from "@/components/RequireAuth";
import { todayIso } from "@/lib/periodUtils";

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

function nextFriday(): string {
  const d = new Date();
  d.setDate(d.getDate() + (((5 - d.getDay() + 7) % 7) || 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function WelcomePage() {
  return (
    <RequireAuth>
      <Onboarding />
    </RequireAuth>
  );
}

function Onboarding() {
  const state = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [takeHome, setTakeHome] = useState("");
  const [schedule, setSchedule] = useState<Schedule>("biweekly");
  const [nextPayday, setNextPayday] = useState(nextFriday());
  const [secondDay, setSecondDay] = useState("31");
  const [bills, setBills] = useState<BillDraft[]>([{ ...EMPTY_BILL }, { ...EMPTY_BILL }, { ...EMPTY_BILL }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const alreadySetUp = state.status === "authed" && state.user.pay_cycle_mode !== null;
  useEffect(() => {
    if (alreadySetUp) router.replace("/");
  }, [alreadySetUp, router]);
  if (state.status !== "authed" || alreadySetUp) return null;

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

  async function finish(includeBills: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      const { first_period_id } = await completeOnboarding({
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
      // Full navigation so every page re-reads the account (pay schedule now set).
      window.location.href = first_period_id ? `/manage/${first_period_id}` : "/";
    } catch (err) {
      setError(String(err).replace(/^Error:\s*/, ""));
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 mt-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Rev<span className="text-sky-700">Bill</span>
        </h1>
        {step > 0 && <span className="text-xs text-slate-400">Step {step} of 2</span>}
      </div>

      {error && <p className="text-amber-800 text-sm">{error}</p>}

      {step === 0 && (
        <section className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-slate-900 leading-tight">Let&apos;s put the money you EARN to work.</h2>
            <p className="text-slate-600">
              Tell us about your paycheck and your biggest bills. In about a minute you&apos;ll see exactly what every
              dollar is doing.
            </p>
          </div>
          <button onClick={() => setStep(1)} className="w-full px-4 py-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-medium">
            Get started
          </button>
        </section>
      )}

      {step === 1 && (
        <form onSubmit={payContinue} className="space-y-5">
          <h2 className="text-xl font-semibold text-slate-900">Your pay</h2>
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
            <h2 className="text-xl font-semibold text-slate-900">Your 3 biggest bills</h2>
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
            onClick={() => finish(true)}
            disabled={submitting}
            className="w-full px-4 py-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-medium disabled:opacity-60"
          >
            {submitting ? "Setting up…" : "Show my plan"}
          </button>
          <button onClick={() => finish(false)} disabled={submitting} className="w-full text-sm text-slate-500 hover:underline">
            Skip for now
          </button>
        </section>
      )}
    </main>
  );
}
