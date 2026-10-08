"use client";

import RequireAuth from "@/components/RequireAuth";
import DashboardHeader from "@/components/DashboardHeader";

const STEPS: { title: string; body: string }[] = [
  {
    title: "1. Choose how your pay cycles work",
    body:
      'On first login you\'ll be asked to pick Monthly, Bi-weekly, Weekly, or Custom. The first three auto-generate a rolling 6 months of upcoming cycles for you -- nothing to remember to create. Custom means you add each cycle yourself whenever you want. You can change this later from Setup > "Change cycle schedule."',
  },
  {
    title: "2. Add your income sources",
    body:
      'In Setup, add one "Payment Cycle" per job or income source (e.g. a paycheck, rental income) with its own amount and schedule. One-off income (like a single side gig payment) doesn\'t need a source at all -- add it directly on the pay period page with "+ Add one-time income."',
  },
  {
    title: "3. Add your bills",
    body:
      'Still in Setup, add each recurring bill: pick a category, enter the amount, and check "Revolving" if it\'s a credit card where you sometimes pay less than the full balance. Due day is optional but worth setting (1-31) -- it\'s what powers accurate "due soon" and "overdue" reminders on your dashboard, independent of your pay schedule.',
  },
  {
    title: "4. Find your current cycle",
    body:
      'Go to Pay Periods. Your current cycle -- the one for your most recent payday -- is always pinned at the top, with the next one right below it. Everything else is grouped by year and quarter, with the current year expanded and split into Upcoming and Past so old and future cycles never mix.',
  },
  {
    title: "5. Mark things paid and received as they happen",
    body:
      "Open a cycle and check off income as it arrives and bills as you pay them. Checking a box auto-fills the expected amount, but you can still edit the number afterward without it unchecking itself -- so paying a different amount than planned is never a fight with the checkbox.",
  },
  {
    title: "6. Check At a Glance for the big picture",
    body:
      "This is your dashboard: what's left this cycle, recurring bills and income broken down by category, credit card balances with a projected payoff date, and anything due or overdue. Every ⓘ icon on the page explains exactly how that number is calculated.",
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What\'s the difference between "Current" and "Next"?',
    a: "Current is the cycle for your most recent payday. Each cycle starts on a payday and runs until the day before the next one, so its bills are the ones that paycheck pays. Next is simply the cycle right after it. Both are pinned at the top of Pay Periods so you never have to hunt for them.",
  },
  {
    q: "Why does a bill show \"Overdue\" even though I already paid it?",
    a: 'This shouldn\'t happen, and if it does it\'s worth checking: overdue only triggers when a bill\'s own due date has passed with nothing paid toward it and it isn\'t checked "paid." Paying ahead of the due date in an earlier cycle counts, and checking "paid" always overrides the raw dollar amount -- so a partial payment you\'ve marked paid never shows as overdue.',
  },
  {
    q: "What does \"Due\" mean if I haven't set a due day for a bill?",
    a: "Without a due day set, the app falls back to showing the cycle's own pay date as a rough due date. Set a specific due day (1-31) on the bill in Setup for a precise reminder instead.",
  },
  {
    q: 'How is "Paid off by" calculated for my credit cards?',
    a: "It reads your own plan first: if you've already entered future payments against a card, it walks forward through them and finds the exact cycle where they bring the balance to zero. If you haven't planned that far ahead, it estimates instead from the average of everything you've paid so far.",
  },
  {
    q: 'What does "revolving" mean, and when should I check it?',
    a: "Check it for credit cards or any bill where you carry a balance and sometimes pay less than the full amount. It changes how the balance is tracked: instead of resetting to a fixed target every cycle, it carries forward and only goes down by what you actually pay.",
  },
  {
    q: "What's the difference between the Monthly and Annual toggle on the dashboard?",
    a: "Both show real amounts you've actually paid or received -- not a projection. Monthly sums cycles whose pay date falls in the current calendar month; Annual does the same for the current calendar year. An unpaid bill or unreceived paycheck contributes nothing until it's marked done.",
  },
  {
    q: "Can I add a payment cycle further into the future than what's already generated?",
    a: '\'Yes -- on Pay Periods, click "+ Add one more cycle" (auto-generating modes) or "+ New period" (custom mode). It follows the same cadence math as your regular schedule, so the dates line up correctly.',
  },
  {
    q: "What happens if I delete a bill or income source that has history?",
    a: "It's archived instead of deleted, so past cycles keep their real numbers. It also stops appearing in new cycles going forward. You can see archived sources in a collapsed section at the bottom of Setup.",
  },
  {
    q: "Can I edit a past, already-closed cycle?",
    a: "Yes -- nothing locks once a cycle's pay date passes. Open it from the Past section of Pay Periods and adjust amounts or checkboxes the same as any other cycle.",
  },
];

export default function HelpPage() {
  return (
    <RequireAuth>
      <main className="max-w-2xl mx-auto p-6 space-y-8">
        <DashboardHeader active="/help" />

        <section className="space-y-4">
          <div>
            <h2 className="font-semibold text-lg">Getting started</h2>
            <p className="text-xs text-slate-400">A quick walkthrough for setting this up for yourself.</p>
          </div>
          <div className="space-y-4">
            {STEPS.map((step) => (
              <div key={step.title} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="text-sm font-medium mb-1">{step.title}</div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="font-semibold text-lg">Frequently asked questions</h2>
            <p className="text-xs text-slate-400">Click a question to expand it.</p>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700">
            {FAQS.map((item) => (
              <details key={item.q} className="group p-4">
                <summary className="cursor-pointer text-sm font-medium list-none flex items-start justify-between gap-3">
                  <span>{item.q}</span>
                  <span className="text-slate-400 shrink-0 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </RequireAuth>
  );
}
