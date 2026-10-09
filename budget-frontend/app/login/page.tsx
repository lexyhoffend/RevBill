"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { isWakingError, login, withWakeRetry } from "@/lib/api";
import WakingUp from "@/components/WakingUp";
import PasswordInput from "@/components/PasswordInput";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [waking, setWaking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setWaking(false);
    try {
      await withWakeRetry(() => login(email, password), () => setWaking(true));
      router.push("/");
    } catch (err) {
      setError(
        isWakingError(err)
          ? "RevBill is taking longer than usual to wake up. Please try again in a moment."
          : "Incorrect email or password"
      );
    } finally {
      setSubmitting(false);
      setWaking(false);
    }
  }

  return (
    <main className="max-w-sm mx-auto p-6 mt-16 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Rev<span className="text-sky-700 dark:text-sky-400">Bill</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">Log in</p>
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
        <PasswordInput value={password} onChange={setPassword} placeholder="Password" required />
        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium disabled:opacity-60"
        >
          {waking ? <WakingUp compact /> : submitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="text-sm text-slate-400">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-sky-700 dark:text-sky-400 hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
