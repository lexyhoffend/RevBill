"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signup } from "@/lib/api";
import PasswordInput from "@/components/PasswordInput";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (!agreed) {
      setError("Please confirm you're 18 or older and agree to the Terms and Privacy Policy");
      return;
    }
    setSubmitting(true);
    try {
      await signup(email, password, agreed);
      // New accounts get the first-time pop-up (shown by RequireAuth)
      router.push("/");
    } catch (err) {
      setError(String(err).replace(/^Error:\s*/, ""));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-sm mx-auto p-6 mt-16 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Rev<span className="text-sky-700 dark:text-sky-400">Bill</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">Create your account</p>
      </div>

      {error && <p className="text-amber-700 text-sm">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="you@example.com"
          required
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-transparent text-sm"
        />
        <PasswordInput
          value={password}
          onChange={setPassword}
          placeholder="Password (8+ characters)"
          required
          minLength={8}
        />
        <PasswordInput value={confirm} onChange={setConfirm} placeholder="Confirm password" required />
        <label className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            required
            className="w-4 h-4 mt-px accent-sky-700 shrink-0"
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
          type="submit"
          disabled={submitting || !agreed}
          className="w-full px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-sm text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="text-sky-700 dark:text-sky-400 hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
