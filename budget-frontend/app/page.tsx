"use client";

import RequireAuth from "@/components/RequireAuth";
import RequirePayCycle from "@/components/RequirePayCycle";
import DashboardHeader from "@/components/DashboardHeader";
import AtAGlance from "@/components/AtAGlance";

export default function Home() {
  return (
    <RequireAuth>
      <RequirePayCycle>
        <main className="max-w-2xl mx-auto p-6 space-y-6">
          <DashboardHeader active="/" />
          <AtAGlance />
        </main>
      </RequirePayCycle>
    </RequireAuth>
  );
}
