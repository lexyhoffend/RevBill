"use client";

import { useState } from "react";
import { IncomeEntry } from "@/lib/api";
import { useAmountField } from "@/components/useAmountField";

type Props = {
  entry: IncomeEntry;
  onSave: (actual: number, isReceived?: boolean) => Promise<void>;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function IncomeLineRow({ entry, onSave }: Props) {
  const amount = useAmountField(entry.actual_amount, (n) => onSave(n));
  const [saving, setSaving] = useState(false);
  const [pendingReceived, setPendingReceived] = useState<boolean | null>(null);
  if (pendingReceived !== null && pendingReceived === entry.is_received && !saving) setPendingReceived(null);
  const shortfall = entry.expected_amount - entry.actual_amount;

  // Same rules as BillLineRow.markPaid: keep a typed amount, only fill in the
  // expected amount when empty, and send both together.
  async function markReceived(isReceived: boolean) {
    setSaving(true);
    setPendingReceived(isReceived);
    const typed = amount.numeric;
    const newAmount = isReceived ? (typed > 0 ? typed : entry.expected_amount) : 0;
    amount.set(newAmount);
    await onSave(newAmount, isReceived);
    setSaving(false);
  }

  const isReceived = pendingReceived ?? entry.is_received;

  return (
    <div className="flex items-center justify-between py-2 border-b border-emerald-100 dark:border-emerald-900/40">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isReceived}
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
        {isReceived ? (
          <span className="text-xs text-emerald-600">received</span>
        ) : shortfall > 0 && entry.actual_amount > 0 ? (
          <span className="text-xs text-amber-600">short {fmt(shortfall)}</span>
        ) : (
          <span className="text-xs text-slate-400">not received</span>
        )}
        <span className="text-emerald-700 dark:text-emerald-400 text-sm">+</span>
        <input
          type="number"
          {...amount.inputProps}
          className="w-28 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-right bg-transparent text-emerald-700 dark:text-emerald-400 font-medium"
        />
      </div>
    </div>
  );
}
