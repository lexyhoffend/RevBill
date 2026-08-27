"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { updateProfile } from "@/lib/api";
import RequireAuth, { useAuth } from "@/components/RequireAuth";
import AccountNav from "@/components/AccountNav";
import InfoTooltip from "@/components/InfoTooltip";

export default function AccountPage() {
  return (
    <RequireAuth>
      <AccountContent />
    </RequireAuth>
  );
}

function AccountContent() {
  const state = useAuth();
  const [name, setName] = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state.status === "authed" && !nameLoaded) {
      setName(state.user.name ?? "");
      setNameLoaded(true);
    }
  }, [state, nameLoaded]);

  if (state.status !== "authed") {
    return <main className="max-w-2xl mx-auto p-6 text-sm text-slate-400">Loading…</main>;
  }

  const { user } = state;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile({ name: name.trim() || null });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function copyId() {
    await navigator.clipboard.writeText(user.user_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-6">
        <Link href="/" className="text-sm text-slate-500 hover:underline shrink-0">
          ← Back
        </Link>
        <AccountNav />
      </div>

      <h1 className="text-2xl font-bold">Account</h1>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-1">
        <div className="text-sm font-medium flex items-center gap-1">
          Your ID
          <InfoTooltip text="A 7-digit account number other people can type in to add you to a share or split, instead of needing your email." />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-mono tracking-widest">{user.user_number}</span>
          <button onClick={copyId} className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-slate-400">Email: {user.email}</p>
      </div>

      <form onSubmit={save} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="text-sm font-medium flex items-center gap-1">
          Your name
          <InfoTooltip text="Shown to people you share or split bills with, in place of your email address." />
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            placeholder="e.g. Lexy Hoffend"
            className="flex-1 min-w-48 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {saved && <p className="text-xs text-emerald-700 dark:text-emerald-400">Saved.</p>}
      </form>
    </main>
  );
}
