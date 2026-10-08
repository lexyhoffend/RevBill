"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SavingsBucket, createSavingsBucket, listSavingsBuckets, updateSavingsBucket } from "@/lib/api";
import { money } from "@/components/plan/format";

const PRESETS = ["Emergency fund", "Vacation", "Big purchase"];

/** Setup's third section, next to income and bills: savings goals and how
 * much to set aside each paycheck (which pre-fills "Future You" when a
 * paycheck is planned). Progress and deposits live on the Savings tab. */
export default function SavingsGoalsSetup() {
  const [goals, setGoals] = useState<SavingsBucket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [perPaycheck, setPerPaycheck] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [alreadySaved, setAlreadySaved] = useState("");
  const [saving, setSaving] = useState(false);

  function refresh() {
    listSavingsBuckets().then(setGoals).catch((e) => setError(String(e)));
  }
  useEffect(refresh, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give your savings goal a name.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createSavingsBucket({
        name: name.trim(),
        per_paycheck_amount: Number(perPaycheck) || null,
        goal_amount: Number(goalAmount) || null,
        starting_balance: Number(alreadySaved) || 0,
      });
      setName("");
      setPerPaycheck("");
      setGoalAmount("");
      setAlreadySaved("");
      refresh();
    } catch (err) {
      setError(String(err).replace(/^Error:\s*/, ""));
    } finally {
      setSaving(false);
    }
  }

  const perPaycheckTotal = goals.reduce((sum, g) => sum + (g.per_paycheck_amount ?? 0), 0);

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-sky-700">Savings goals (Future You)</h2>
      <p className="text-xs text-slate-500">
        Pay Future You first: pick what you&apos;re saving for and how much to set aside each paycheck. It&apos;s
        included automatically when you plan a paycheck, and you can always change it that cycle.
      </p>

      {goals.length > 0 && (
        <div>
          {goals.map((g) => (
            <GoalRow key={g.id} goal={g} onChanged={refresh} />
          ))}
          {perPaycheckTotal > 0 && (
            <div className="text-xs text-slate-500 pt-2">
              Setting aside <span className="font-medium text-slate-800">{money(perPaycheckTotal)}</span> each paycheck in total.
            </div>
          )}
        </div>
      )}

      {error && <p className="text-amber-700 text-sm">{error}</p>}

      <form onSubmit={add} className="rounded-xl border border-sky-200 p-4 space-y-3 bg-white">
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setName(p)}
              className={`text-xs px-3 py-1 rounded-full border ${
                name === p ? "border-sky-500 bg-sky-50 text-sky-800" : "border-slate-300 text-slate-600 hover:border-sky-400"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What are you saving for?"
            aria-label="Savings goal name"
            className="flex-1 min-w-48 border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
          />
          <input
            value={perPaycheck}
            onChange={(e) => setPerPaycheck(e.target.value)}
            type="number"
            min={0}
            step="0.01"
            placeholder="Each paycheck $"
            aria-label="Set aside each paycheck"
            className="w-40 border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            value={goalAmount}
            onChange={(e) => setGoalAmount(e.target.value)}
            type="number"
            min={0}
            step="0.01"
            placeholder="Goal $ (optional)"
            aria-label="Goal amount"
            className="w-40 border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
          />
          <input
            value={alreadySaved}
            onChange={(e) => setAlreadySaved(e.target.value)}
            type="number"
            min={0}
            step="0.01"
            placeholder="Already saved $ (optional)"
            aria-label="Already saved"
            className="w-52 border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Adding…" : "Add Savings Goal"}
          </button>
        </div>
      </form>
      <Link href="/savings" className="text-xs text-sky-700 hover:underline">
        Track progress and deposits on the Savings tab →
      </Link>
    </section>
  );
}

function GoalRow({ goal, onChanged }: { goal: SavingsBucket; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(goal.name);
  const [perPaycheck, setPerPaycheck] = useState(goal.per_paycheck_amount ? String(goal.per_paycheck_amount) : "");
  const [goalAmount, setGoalAmount] = useState(goal.goal_amount ? String(goal.goal_amount) : "");

  async function save() {
    await updateSavingsBucket(goal.id, {
      name: name.trim() || goal.name,
      per_paycheck_amount: Number(perPaycheck) || null,
      goal_amount: Number(goalAmount) || null,
    });
    setEditing(false);
    onChanged();
  }

  if (editing) {
    return (
      <div className="flex gap-2 items-center flex-wrap py-2 border-b border-slate-100">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Savings goal name"
          className="flex-1 min-w-40 border border-slate-300 rounded px-2 py-1 text-sm bg-white"
        />
        <label className="flex items-center gap-1 text-xs text-slate-600">
          Each paycheck $
          <input
            value={perPaycheck}
            onChange={(e) => setPerPaycheck(e.target.value)}
            type="number"
            min={0}
            className="w-24 border border-slate-300 rounded px-2 py-1 text-sm bg-white"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          Goal $
          <input
            value={goalAmount}
            onChange={(e) => setGoalAmount(e.target.value)}
            type="number"
            min={0}
            className="w-24 border border-slate-300 rounded px-2 py-1 text-sm bg-white"
          />
        </label>
        <button onClick={save} className="text-xs text-sky-700 font-medium">Save</button>
        <button onClick={() => setEditing(false)} className="text-xs text-slate-400">Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100">
      <div>
        <div className="text-sm font-medium">{goal.name}</div>
        <div className="text-xs text-slate-500">
          {goal.goal_amount ? `${money(goal.total_saved)} of ${money(goal.goal_amount)} goal` : `${money(goal.total_saved)} saved`}
          {goal.percent_complete != null && ` (${Math.round(goal.percent_complete)}%)`}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-800">
          {goal.per_paycheck_amount ? `${money(goal.per_paycheck_amount)} / paycheck` : "No set amount"}
        </span>
        <button onClick={() => setEditing(true)} className="text-xs text-slate-500 hover:text-sky-700">
          Edit
        </button>
      </div>
    </div>
  );
}
