"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, getMe, withWakeRetry } from "@/lib/api";
import WakingUp from "@/components/WakingUp";
import TermsGate from "@/components/TermsGate";
import OnboardingModal from "@/components/popups/OnboardingModal";
import WelcomeModal, { shouldSkipWelcome } from "@/components/popups/WelcomeModal";

type AuthState = { status: "loading"; waking?: boolean } | { status: "authed"; user: User } | { status: "anon" };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const router = useRouter();

  useEffect(() => {
    // Keep retrying while the server wakes up -- a timeout then must not be
    // mistaken for "logged out" and bounce the user to the login page.
    withWakeRetry(getMe, () => setState((s) => (s.status === "loading" ? { status: "loading", waking: true } : s)))
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
    return state.waking ? <WakingUp /> : <main className="max-w-2xl mx-auto p-6 text-sm text-slate-400">Loading…</main>;
  }
  if (state.status === "anon") {
    return null; // redirect already in flight
  }
  if (state.user.needs_terms) {
    return <TermsGate />;
  }
  // First visit: no pay schedule yet, so the key-information pop-up shows
  // over an empty page. Later visits: the once-per-cycle welcome.
  if (state.user.pay_cycle_mode === null) {
    return (
      <>
        {children}
        <OnboardingModal />
      </>
    );
  }
  return (
    <>
      {children}
      {state.user.welcome && !shouldSkipWelcome() && <WelcomeModal welcome={state.user.welcome} name={state.user.name} />}
    </>
  );
}
