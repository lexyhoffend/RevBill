"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Welcome, markWelcomeSeen } from "@/lib/api";
import Modal from "@/components/popups/Modal";
import { money } from "@/components/plan/format";

/** Set by the first-time pop-up so the "Welcome back" waits for the next visit. */
export const SKIP_WELCOME_KEY = "revbill:skipWelcome";

export function shouldSkipWelcome(): boolean {
  try {
    return sessionStorage.getItem(SKIP_WELCOME_KEY) === "1";
  } catch {
    return false;
  }
}

/** Once per pay cycle: greets the user with that cycle's income from Setup.
 * "Finish Managing" closes it (recorded on the server, so it won't repeat on
 * another device) and opens that cycle's page. */
export default function WelcomeModal({ welcome, name }: { welcome: Welcome; name: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  if (!open) return null;

  async function finish() {
    setSaving(true);
    try {
      await markWelcomeSeen(welcome.period_id);
    } catch {
      // still let them through; worst case they see it once more
    }
    setOpen(false);
    router.push(`/period/${welcome.period_id}`);
  }

  const first = name?.trim().split(" ")[0];
  return (
    <Modal labelledBy="welcome-title">
      <div className="space-y-3 text-center">
        <div className="text-4xl" aria-hidden>
          👋
        </div>
        <h2 id="welcome-title" className="text-2xl font-bold text-slate-900 leading-snug">
          Welcome back{first ? `, ${first}` : ""}! Let&apos;s best manage the{" "}
          <span className="text-sky-700">{money(welcome.amount)}</span> you EARNED!
        </h2>
      </div>
      <button
        onClick={finish}
        disabled={saving}
        className="w-full px-4 py-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-medium disabled:opacity-60"
      >
        Finish Managing
      </button>
    </Modal>
  );
}
