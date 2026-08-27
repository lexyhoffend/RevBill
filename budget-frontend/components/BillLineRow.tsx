"use client";

import { useEffect, useRef, useState } from "react";
import { BillEntry } from "@/lib/api";
import BillCategoryIcon from "@/components/BillCategoryIcon";
import Confetti from "@/components/Confetti";

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
  const [value, setValue] = useState(String(entry.actual_amount));
  const [saving, setSaving] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [justPaidOff, setJustPaidOff] = useState(false);
  const prevOwedRef = useRef(entry.owed_balance);

  // A revolving card's balance hitting exactly zero -- coming down from
  // something owed -- is a bigger moment than a routine paid checkbox, so it
  // gets its own celebration independent of whether *this* checkbox was
  // touched (the payoff might land from a payment made in an earlier cycle).
  useEffect(() => {
    const prev = prevOwedRef.current;
    prevOwedRef.current = entry.owed_balance;
    if (entry.is_revolving && prev > 0 && entry.owed_balance === 0) {
      setJustPaidOff(true);
      setBurstKey((k) => k + 1);
      const t = setTimeout(() => setJustPaidOff(false), 2500);
      return () => clearTimeout(t);
    }
  }, [entry.owed_balance, entry.is_revolving]);

  async function markPaid(paid: boolean) {
    setSaving(true);
    const newAmount = paid ? entry.target_amount : 0;
    setValue(String(newAmount));
    await onSave(newAmount, paid);
    if (paid) setBurstKey((k) => k + 1);
    setSaving(false);
  }

  return (
    <div className="relative flex items-center justify-between py-2 border-b border-red-100 dark:border-red-900/30">
      <Confetti burstKey={burstKey} />
      {justPaidOff && (
        <span className="absolute -top-1 right-0 text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full px-2 py-0.5">
          Paid off! 🎉
        </span>
      )}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={entry.is_paid}
          disabled={saving}
          onChange={(e) => markPaid(e.target.checked)}
          className="w-4 h-4 accent-emerald-600"
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
              <span className={entry.is_overdue ? "text-red-600 dark:text-red-400 font-medium" : undefined}>
                {" "}
                · {entry.is_overdue ? "Overdue" : "Due"} {entry.due_date}
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
        {entry.is_paid ? (
          <span className="text-xs text-emerald-600">paid</span>
        ) : entry.actual_amount > 0 ? (
          <span className="text-xs text-amber-600">partial</span>
        ) : (
          <span className="text-xs text-slate-400">not paid</span>
        )}
        <span className="text-red-600 dark:text-red-400 text-sm">-</span>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => onSave(Number(value) || 0)}
          className="w-28 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-right bg-transparent text-red-600 dark:text-red-400 font-medium"
        />
      </div>
    </div>
  );
}
