"use client";

import { useAuth } from "./RequireAuth";

/** Hides a page until the account has a pay schedule. A brand-new account
 * gets the first-time pop-up instead (rendered by RequireAuth). */
export default function RequirePayCycle({ children }: { children: React.ReactNode }) {
  const state = useAuth();
  if (state.status !== "authed" || state.user.pay_cycle_mode === null) {
    return null;
  }
  return <>{children}</>;
}
