"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, getMe } from "@/lib/api";

type AuthState = { status: "loading" } | { status: "authed"; user: User } | { status: "anon" };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const router = useRouter();

  useEffect(() => {
    getMe()
      .then((user) => setState({ status: "authed", user }))
      .catch(() => {
        setState({ status: "anon" });
        router.replace("/login");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const state = useAuth();

  if (state.status === "loading") {
    return <main className="max-w-2xl mx-auto p-6 text-sm text-slate-400">Loading…</main>;
  }
  if (state.status === "anon") {
    return null; // redirect already in flight
  }
  return <>{children}</>;
}
