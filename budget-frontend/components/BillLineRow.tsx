"use client";

import { useState } from "react";
import { BillEntry } from "@/lib/api";
import BillCategoryIcon from "@/components/BillCategoryIcon";
import { useAmountField } from "@/components/useAmountField";

type Props = {
  entry: BillEntry;
  onSave: (actual: number, isPaid?: boolean) => Promise<void>;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function ordinal(n: number): string {
  if (n % 10 === 1 && n !== 11) return "st";
  if (n % 10 === 2 && n !== 12) return "nd";
  if (n % 10 === 3 && n !== 13) return "rd";
  return "th";
}

export default function BillLineRow({ entry, onSave }: Props) {
  const amount = useAmountField(entry.actual_amount, (n) => onSave(n));
  const [saving, setSaving] = useState(false);
  // Shows the click immediately instead of waiting for the reload, and drops
  // itself once the server's value catches up.
  const [pendingPaid, setPendingPaid] = useState<boolean | null>(null);
  if (pendingPaid !== null && pendingPaid === entry.is_paid && !saving) setPendingPaid(null);

  // Checking keeps whatever amount is already typed and only fills in the
  // target when the amount is still empty. The typed amount is sent along
  // with the flag, so the result is the same whichever of "check" and "type
  // an amount" happens first. Payoff celebrations live on At a Glance, after
  // the real payments are saved, never here.
  async function markPaid(paid: boolean) {
    setSaving(true);
    setPendingPaid(paid);
    const typed = amount.numeric;
    const newAmount = paid ? (typed > 0 ? typed : entry.target_amount) : 0;
    amount.set(newAmount);
    await onSave(newAmount, paid);
    setSaving(false);
  }

  const isPaid = pendingPaid ?? entry.is_paid;

  return (
    <div className="relative flex items-center justify-between py-2 border-b border-slate-100">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isPaid}
          disabled={saving}
          onChange={(e) => markPaid(e.target.checked)}
          className="w-4 h-4 accent-sky-700"
          aria-label={`Mark ${entry.source_name} paid`}
        />
        <BillCategoryIcon category={entry.category} className="w-4 h-4 shrink-0" />
        <div>
          <div className="text-sm font-medium">
            {entry.source_name}
            {entry.is_revolving && (
              <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-400 border border-slate-300 dark:border-slate-600 rounded px-1">
                revolving
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400">
            {entry.category} · Target -{fmt(entry.target_amount)}
            {entry.due_date ? (
              <span className={entry.is_overdue ? "text-amber-800 font-medium" : undefined}>
                {" "}
                · {entry.is_overdue ? "⚠ Overdue" : "Due"} {entry.due_date}
              </span>
            ) : (
              entry.due_day && (
                <span>
                  {" "}
                  · Due on the {entry.due_day}
                  {ordinal(entry.due_day)}
                </span>
              )
            )}
            {entry.split_shared && entry.split_count > 1 && (
              <span>
                {" "}
                · Split {entry.split_count} ways: {fmt(entry.split_amount)} each
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isPaid ? (
          <span className="text-xs font-medium text-green-700">✓ paid</span>
        ) : entry.actual_amount > 0 ? (
          <span className="text-xs text-amber-700">partial</span>
        ) : (
          <span className="text-xs text-slate-400">not paid</span>
        )}
        <span className="text-slate-500 text-sm">-</span>
        <input
          type="number"
          {...amount.inputProps}
          className="w-28 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-right bg-white text-slate-800 font-medium"
        />
      </div>
    </div>
  );
}
