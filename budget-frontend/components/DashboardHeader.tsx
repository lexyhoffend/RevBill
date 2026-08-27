"use client";

import Link from "next/link";
import AccountNav from "@/components/AccountNav";

const TABS = [
  { href: "/", label: "At a Glance" },
  { href: "/periods", label: "Pay Periods" },
  { href: "/sources", label: "Setup" },
  { href: "/savings", label: "Savings" },
  { href: "/history", label: "History" },
  { href: "/calendar", label: "Calendar" },
  { href: "/sharing", label: "Sharing" },
  { href: "/help", label: "Help" },
] as const;

export default function DashboardHeader({ active }: { active: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-6">
        <h1 className="text-2xl font-bold shrink-0">
          Rev<span className="text-emerald-700 dark:text-emerald-400">Bill</span>
        </h1>
        <AccountNav />
      </div>
      <div className="flex gap-4 border-t border-slate-100 dark:border-slate-800 pt-3 flex-wrap">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`text-sm hover:underline ${
              tab.href === active
                ? "font-semibold text-emerald-700 dark:text-emerald-400"
                : "text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
