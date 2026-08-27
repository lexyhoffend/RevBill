"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PeriodSavingsEntry, SavingsBucket, addPeriodSavingsEntry, deleteSavingsEntry, listSavingsBuckets } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

type Props = {
  periodId: number;
  entries: PeriodSavingsEntry[];
  leftOver: number;
  onAdded: () => void;
};

export default function SavingsSection({ periodId, entries, leftOver, onAdded }: Props) {
  const { confirm } = useConfirm();
  const [buckets, setBuckets] = useState<SavingsBucket[]>([]);
  const [open, setOpen] = useState(false);
  const [bucketId, setBucketId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSavingsBuckets()
      .then((b) => {
        setBuckets(b);
        if (b.length > 0) setBucketId(b[0].id);
      })
      .catch((e) => setError(String(e)));
  }, []);

  function startAdding() {
    // default suggestion is whatever's currently left, so it's easy to sweep it all into savings
    setAmount(leftOver > 0 ? String(leftOver) : "");
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bucketId || !amount) return;
    await addPeriodSavingsEntry(periodId, { bucket_id: bucketId, amount: Number(amount) || 0 });
    setOpen(false);
    onAdded();
  }

  async function remove(entry: PeriodSavingsEntry) {
    const ok = await confirm(`Remove the ${fmt(entry.amount)} moved to "${entry.bucket_name}"?`, { destructive: true });
    if (!ok) return;
    await deleteSavingsEntry(entry.id);
    onAdded();
  }

  return (
    <section className="space-y-2">
      <h2 className="font-semibold text-emerald-700">Savings</h2>

      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.map((e) => (
            <div key={e.id} className="flex justify-between items-center text-sm py-1 border-b border-emerald-100">
              <span>{e.bucket_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-emerald-700 font-medium">+{fmt(e.amount)}</span>
                <button onClick={() => remove(e)} className="text-xs text-red-500 hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {buckets.length === 0 ? (
        <p className="text-sm text-slate-400">
          No savings buckets yet.{" "}
          <Link href="/savings" className="text-emerald-700 hover:underline">
            Create one
          </Link>{" "}
          to move some of what's left here.
        </p>
      ) : !open ? (
        <button onClick={startAdding} className="text-sm text-emerald-700 hover:underline">
          + Move to Savings
        </button>
      ) : (
        <form onSubmit={submit} className="flex gap-2 items-center flex-wrap">
          <select
            value={bucketId ?? ""}
            onChange={(e) => setBucketId(Number(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-2 bg-transparent text-sm"
          >
            {buckets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            placeholder="Amount $"
            className="w-32 border border-slate-300 rounded-lg px-3 py-2 bg-transparent text-sm"
          />
          <button type="submit" className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium">
            Add
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-400">
            Cancel
          </button>
        </form>
      )}
    </section>
  );
}
