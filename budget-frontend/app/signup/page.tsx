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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      await signup(email, password);
      // New accounts go straight into Setup to add their Payment Cycles and bills
      router.push("/sources");
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
          Rev<span className="text-emerald-700 dark:text-emerald-400">Bill</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">Create your account</p>
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
        <PasswordInput
          value={password}
          onChange={setPassword}
          placeholder="Password (8+ characters)"
          required
          minLength={8}
        />
        <PasswordInput value={confirm} onChange={setConfirm} placeholder="Confirm password" required />
        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-sm text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="text-emerald-700 dark:text-emerald-400 hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
