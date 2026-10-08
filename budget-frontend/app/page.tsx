"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import RequirePayCycle from "@/components/RequirePayCycle";
import { listPeriods } from "@/lib/api";
import { findCurrentPeriod } from "@/lib/periodUtils";

/** No home screen: opening RevBill lands on the cycle you're in now. */
export default function Home() {
  return (
    <RequireAuth>
      <RequirePayCycle>
        <GoToCurrentCycle />
      </RequirePayCycle>
    </RequireAuth>
  );
}

function GoToCurrentCycle() {
  const router = useRouter();
  useEffect(() => {
    listPeriods()
      .then((periods) => {
        const current = findCurrentPeriod(periods);
        router.replace(current ? `/period/${current.id}` : "/periods");
      })
      .catch(() => router.replace("/periods"));
  }, [router]);
  return <main className="max-w-2xl mx-auto p-6 text-sm text-slate-400">Loading…</main>;
}
