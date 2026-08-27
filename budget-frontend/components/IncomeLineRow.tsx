"use client";

import { useState } from "react";
import { IncomeEntry } from "@/lib/api";

type Props = {
  entry: IncomeEntry;
  onSave: (actual: number, isReceived?: boolean) => Promise<void>;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function IncomeLineRow({ entry, onSave }: Props) {
  const [value, setValue] = useState(String(entry.actual_amount));
  const [saving, setSaving] = useState(false);
  const shortfall = entry.expected_amount - entry.actual_amount;

  async function markReceived(isReceived: boolean) {
    setSaving(true);
    const newAmount = isReceived ? entry.expected_amount : 0;
    setValue(String(newAmount));
    await onSave(newAmount, isReceived);
    setSaving(false);
  }

  return (
    <div className="flex items-center justify-between py-2 border-b border-emerald-100 dark:border-emerald-900/40">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={entry.is_received}
          disabled={saving}
          onChange={(e) => markReceived(e.target.checked)}
          className="w-4 h-4 accent-emerald-600"
          aria-label={`Mark ${entry.source_name} received`}
        />
        <div>
          <div className="text-sm font-medium">
            {entry.source_name}
            {entry.is_one_time && (
              <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400 border border-slate-300 dark:border-slate-600 rounded px-1">
                one-time
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400">Expected +{fmt(entry.expected_amount)}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {entry.is_received ? (
          <span className="text-xs text-emerald-600">received</span>
        ) : shortfall > 0 && entry.actual_amount > 0 ? (
          <span className="text-xs text-amber-600">short {fmt(shortfall)}</span>
        ) : (
          <span className="text-xs text-slate-400">not received</span>
        )}
        <span className="text-emerald-700 dark:text-emerald-400 text-sm">+</span>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => onSave(Number(value) || 0)}
          className="w-28 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-right bg-transparent text-emerald-700 dark:text-emerald-400 font-medium"
        />
      </div>
    </div>
  );
}
