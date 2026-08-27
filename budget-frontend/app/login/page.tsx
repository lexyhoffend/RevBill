"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import PasswordInput from "@/components/PasswordInput";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/");
    } catch {
      setError("Incorrect email or password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-sm mx-auto p-6 mt-16 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Rev<span className="text-emerald-700 dark:text-emerald-400">Bill</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">Log in</p>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

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
          className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="text-sm text-slate-400">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-emerald-700 dark:text-emerald-400 hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
