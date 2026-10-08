"use client";

import { useState } from "react";
import Link from "next/link";
import { acceptTerms } from "@/lib/api";

/** Shown instead of the app to a signed-in account that hasn't agreed to the
 * current Terms/Privacy version -- accounts that predate them, or everyone
 * after the policies are updated. Accepting is recorded server-side. */
export default function TermsGate() {
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setSaving(true);
    setError(null);
    try {
      await acceptTerms();
      // Every page reads auth on mount, so a reload is the simplest way to
      // let the whole app see the updated account.
      window.location.reload();
    } catch (err) {
      setError(String(err).replace(/^Error:\s*/, ""));
      setSaving(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 mt-16 space-y-5">
      <h1 className="text-2xl font-bold">
        Rev<span className="text-sky-700 dark:text-sky-400">Bill</span>
      </h1>
      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <p className="font-medium text-slate-900 dark:text-slate-100">We&apos;ve added Terms of Service and a Privacy Policy</p>
        <p>
          They explain what RevBill is (and isn&apos;t), how your information is stored, and how to delete your account.
          Please review and agree to keep using RevBill.
        </p>
      </div>
      {error && <p className="text-amber-700 text-sm">{error}</p>}
      <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="w-4 h-4 mt-0.5 accent-sky-700 shrink-0"
        />
        <span>
          I am 18 or older and agree to the{" "}
          <Link href="/terms" target="_blank" className="text-sky-700 dark:text-sky-400 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="text-sky-700 dark:text-sky-400 hover:underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <button
        onClick={handleContinue}
        disabled={!agreed || saving}
        className="w-full px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium disabled:opacity-60"
      >
        {saving ? "Saving…" : "Continue"}
      </button>
    </main>
  );
}
