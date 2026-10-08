"use client";

import { useState } from "react";
import { Plan, updateIncomeEntry } from "@/lib/api";
import { money } from "@/components/plan/format";

/** The paycheck amount, editable in one tap: typing the real amount marks the
 * paycheck received, which switches the label to "This cycle". */
export default function IncomeEditor({ plan, onChanged }: { plan: Plan; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(plan.income.amount));
  const [saving, setSaving] = useState(false);
  const entryId = plan.income.income_entry_id;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!entryId) return;
    setSaving(true);
    await updateIncomeEntry(entryId, { actual_amount: Number(value) || 0, is_received: true });
    setSaving(false);
    setEditing(false);
    onChanged();
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex items-center gap-2 flex-wrap">
        <span className="text-slate-500 text-sm">$</span>
        <input
          autoFocus
          type="number"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Paycheck amount"
          className="w-36 border border-slate-300 rounded-lg px-3 py-2 bg-white text-lg font-semibold"
        />
        <button type="submit" disabled={saving} className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:underline">
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-baseline gap-3 flex-wrap">
      <span className="text-4xl font-bold tracking-tight text-slate-900">{money(plan.income.amount)}</span>
      <span className="text-xs font-medium text-sky-800 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">
        {plan.income.label}
      </span>
      {plan.income.more_than_usual != null && (
        <span className="text-xs font-semibold text-orange-900 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
          {money(plan.income.more_than_usual)} more than usual!
        </span>
      )}
      {entryId && (
        <button onClick={() => { setValue(String(plan.income.amount)); setEditing(true); }} className="text-sm text-sky-700 hover:underline">
          {plan.income.is_received ? "Edit" : "Got paid? Enter the amount"}
        </button>
      )}
    </div>
  );
}
