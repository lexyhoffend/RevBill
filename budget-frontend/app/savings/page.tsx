"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SavingsBucket, createSavingsBucket, listSavingsBuckets } from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";
import RequirePayCycle from "@/components/RequirePayCycle";
import AccountNav from "@/components/AccountNav";
import SavingsBucketCard from "@/components/SavingsBucketCard";
import EmptyState from "@/components/EmptyState";

export default function SavingsPage() {
  const [buckets, setBuckets] = useState<SavingsBucket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startingBalance, setStartingBalance] = useState("");

  function refresh() {
    listSavingsBuckets().then(setBuckets).catch((e) => setError(String(e)));
  }

  useEffect(refresh, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    await createSavingsBucket({
      name,
      goal_amount: goal ? Number(goal) : null,
      starting_balance: startingBalance ? Number(startingBalance) : 0,
    });
    setName("");
    setGoal("");
    setStartingBalance("");
    refresh();
  }

  return (
    <RequireAuth>
      <RequirePayCycle>
      <main className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-6">
          <Link href="/" className="text-sm text-slate-500 hover:underline shrink-0">
            ← Back
          </Link>
          <AccountNav />
        </div>
        <h1 className="text-2xl font-bold">Savings</h1>
        {error && <p className="text-amber-700 text-sm">{error}</p>}

        {buckets.length === 0 ? (
          <EmptyState
            illustration="piggybank"
            title="No savings goals yet"
            subtitle="Add a bucket below -- an emergency fund, a trip, anything -- then move money into it from any pay cycle."
          />
        ) : (
          <div className="space-y-3">
            {buckets.map((b) => (
              <SavingsBucketCard key={b.id} bucket={b} onChanged={refresh} />
            ))}
          </div>
        )}

        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-sky-200 p-4 space-y-3 bg-sky-50/40"
        >
          <div className="text-sm font-medium text-sky-700">Add a savings goal</div>
          <div className="flex gap-2 flex-wrap">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Emergency Fund"
              className="flex-1 min-w-32 border border-slate-300 rounded-lg px-3 py-2 bg-transparent text-sm"
            />
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              type="number"
              placeholder="Goal $ (optional)"
              className="w-36 border border-slate-300 rounded-lg px-3 py-2 bg-transparent text-sm"
            />
            <input
              value={startingBalance}
              onChange={(e) => setStartingBalance(e.target.value)}
              type="number"
              placeholder="Already saved $ (optional)"
              className="w-40 border border-slate-300 rounded-lg px-3 py-2 bg-transparent text-sm"
            />
            <button type="submit" className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium">
              Add bucket
            </button>
          </div>
        </form>
      </main>
      </RequirePayCycle>
    </RequireAuth>
  );
}
