"use client";

import { useEffect, useRef, useState } from "react";
import {
  SavingsBucket,
  SavingsEntry,
  addToBucketBalance,
  deleteSavingsEntry,
  getBucketEntries,
  updateSavingsBucket,
} from "@/lib/api";
import { useConfirm } from "@/components/ConfirmProvider";
import Confetti from "@/components/Confetti";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function fmtDate(iso: string) {
  return new Date(iso + "Z").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function SavingsBucketCard({ bucket, onChanged }: { bucket: SavingsBucket; onChanged: () => void }) {
  const { confirm } = useConfirm();
  const [addingFunds, setAddingFunds] = useState(false);
  const [amount, setAmount] = useState("");

  const [editingGoal, setEditingGoal] = useState(false);
  const [goal, setGoal] = useState(bucket.goal_amount != null ? String(bucket.goal_amount) : "");

  const [showStatement, setShowStatement] = useState(false);
  const [entries, setEntries] = useState<SavingsEntry[] | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(false);

  async function toggleStatement() {
    if (showStatement) {
      setShowStatement(false);
      return;
    }
    setShowStatement(true);
    setLoadingEntries(true);
    try {
      setEntries(await getBucketEntries(bucket.id));
    } finally {
      setLoadingEntries(false);
    }
  }

  async function refreshEntries() {
    if (!showStatement) return;
    setEntries(await getBucketEntries(bucket.id));
  }

  async function submitAddFunds(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return;
    await addToBucketBalance(bucket.id, { amount: Number(amount) || 0 });
    setAmount("");
    setAddingFunds(false);
    onChanged();
    refreshEntries();
  }

  async function removeEntry(entry: SavingsEntry) {
    const desc = entry.note ?? (entry.period_label ? `from ${entry.period_label}` : "this deposit");
    const ok = await confirm(`Remove ${fmt(entry.amount)} (${desc})?`, { destructive: true });
    if (!ok) return;
    await deleteSavingsEntry(entry.id);
    onChanged();
    refreshEntries();
  }

  async function submitGoal(e: React.FormEvent) {
    e.preventDefault();
    await updateSavingsBucket(bucket.id, { goal_amount: goal ? Number(goal) : null });
    setEditingGoal(false);
    onChanged();
  }

  const pct = bucket.percent_complete;

  const [burstKey, setBurstKey] = useState(0);
  const [justReachedGoal, setJustReachedGoal] = useState(false);
  const prevPctRef = useRef(pct);

  useEffect(() => {
    const prev = prevPctRef.current;
    prevPctRef.current = pct;
    if (pct != null && pct >= 100 && (prev == null || prev < 100)) {
      setJustReachedGoal(true);
      setBurstKey((k) => k + 1);
      const t = setTimeout(() => setJustReachedGoal(false), 2500);
      return () => clearTimeout(t);
    }
  }, [pct]);

  return (
    <div className="relative rounded-xl border border-sky-200 p-4 space-y-2">
      <Confetti burstKey={burstKey} />
      {justReachedGoal && (
        <span className="absolute -top-2 right-3 text-[10px] font-semibold text-sky-700 bg-sky-50 rounded-full px-2 py-0.5">
          Goal reached! 🎉
        </span>
      )}
      <div className="flex justify-between items-baseline">
        <span className="font-medium">{bucket.name}</span>
        <span className="text-sky-700 font-semibold">{fmt(bucket.total_saved)}</span>
      </div>

      {bucket.goal_amount != null ? (
        <>
          <div className="w-full h-2 rounded-full bg-sky-100 overflow-hidden">
            <div
              className="h-full bg-sky-700 rounded-full"
              style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>{pct}% of goal</span>
            <span>Goal {fmt(bucket.goal_amount)}</span>
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-400">No goal set</p>
      )}

      <div className="flex gap-3 text-sm pt-1">
        {!addingFunds && (
          <button onClick={() => setAddingFunds(true)} className="text-sky-700 hover:underline">
            + Add funds
          </button>
        )}
        {!editingGoal && (
          <button onClick={() => setEditingGoal(true)} className="text-slate-500 hover:underline">
            {bucket.goal_amount != null ? "Edit goal" : "Set a goal"}
          </button>
        )}
        <button onClick={toggleStatement} className="text-slate-500 hover:underline">
          {showStatement ? "Hide statement" : "View statement"}
        </button>
      </div>

      {addingFunds && (
        <form onSubmit={submitAddFunds} className="flex gap-2 items-center pt-1">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            placeholder="Amount $"
            autoFocus
            className="w-32 border border-slate-300 rounded-lg px-3 py-2 bg-transparent text-sm"
          />
          <button type="submit" className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium">
            Add
          </button>
          <button type="button" onClick={() => setAddingFunds(false)} className="text-sm text-slate-400">
            Cancel
          </button>
        </form>
      )}

      {editingGoal && (
        <form onSubmit={submitGoal} className="flex gap-2 items-center pt-1">
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            type="number"
            placeholder="Goal $ (leave blank to remove)"
            autoFocus
            className="w-56 border border-slate-300 rounded-lg px-3 py-2 bg-transparent text-sm"
          />
          <button type="submit" className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium">
            Save
          </button>
          <button type="button" onClick={() => setEditingGoal(false)} className="text-sm text-slate-400">
            Cancel
          </button>
        </form>
      )}

      {showStatement && (
        <div className="pt-2 border-t border-slate-100">
          {loadingEntries ? (
            <p className="text-xs text-slate-400 py-2">Loading…</p>
          ) : !entries || entries.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No deposits yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {entries.map((e) => (
                <div key={e.id} className="flex justify-between items-center py-1.5 text-sm">
                  <div>
                    <div>{e.note ?? (e.period_label ? `From ${e.period_label}` : "Deposit")}</div>
                    <div className="text-xs text-slate-400">{fmtDate(e.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={e.amount < 0 ? "text-amber-700" : "text-sky-700"}>
                      {e.amount < 0 ? "-" : "+"}
                      {fmt(Math.abs(e.amount))}
                    </span>
                    <button onClick={() => removeEntry(e)} className="text-xs text-amber-700 hover:underline">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
