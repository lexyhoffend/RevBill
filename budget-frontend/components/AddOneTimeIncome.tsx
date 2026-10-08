"use client";

import { useState } from "react";

type Props = {
  onAdd: (label: string, amount: number) => Promise<void>;
};

export default function AddOneTimeIncome({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label || !amount) return;
    await onAdd(label, Number(amount) || 0);
    setLabel("");
    setAmount("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-sky-700 dark:text-sky-400 hover:underline"
      >
        + Add one-time income
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex gap-2 items-center flex-wrap">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Rover - dog sitting"
        className="flex-1 min-w-40 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        type="number"
        placeholder="Amount $"
        className="w-32 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
      />
      <button type="submit" className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium">
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-400">
        Cancel
      </button>
    </form>
  );
}
