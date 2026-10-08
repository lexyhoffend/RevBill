"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./RequireAuth";

export default function RequirePayCycle({ children }: { children: React.ReactNode }) {
  const state = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "authed" && state.user.pay_cycle_mode === null) {
      router.replace("/welcome");
    }
  }, [state, router]);

  if (state.status !== "authed" || state.user.pay_cycle_mode === null) {
    return null; // still loading (RequireAuth handles that UI) or redirect in flight
  }

  return <>{children}</>;
}
