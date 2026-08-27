"use client";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export type BillGroupAmount = { label: string; amount: number };

// Deliberately spread across the color wheel (not shades of one hue) so
// categories stay visually distinct at a glance -- green is reserved for
// Saved/Left below, so it's excluded here.
const GROUP_COLORS: Record<string, string> = {
  Utilities: "bg-amber-500",
  "Credit Card": "bg-red-600",
  Rent: "bg-blue-500",
  Mortgage: "bg-violet-500",
  Loans: "bg-pink-500",
  "Other bills": "bg-slate-500",
};
const FALLBACK_COLOR = "bg-slate-500";

type Props = {
  income: number;
  billGroups: BillGroupAmount[];
  saved: number;
  leftOver: number;
};

export default function CycleBreakdownBar({ income, billGroups, saved, leftOver }: Props) {
  if (income <= 0) return null;

  let used = 0;
  const segments = billGroups
    .filter((g) => g.amount > 0)
    .map((g) => {
      const pct = Math.min((g.amount / income) * 100, Math.max(100 - used, 0));
      used += pct;
      return { ...g, pct, color: GROUP_COLORS[g.label] ?? FALLBACK_COLOR };
    });

  const savedPct = Math.min((saved / income) * 100, Math.max(100 - used, 0));
  used += savedPct;
  const leftPct = Math.max(100 - used, 0);

  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
        {segments.map(
          (s) => s.pct > 0 && <div key={s.label} className={s.color} style={{ width: `${s.pct}%` }} />
        )}
        {savedPct > 0 && <div className="bg-emerald-600" style={{ width: `${savedPct}%` }} />}
        {leftPct > 0 && <div className="bg-emerald-200" style={{ width: `${leftPct}%` }} />}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${s.color}`} /> {s.label} {fmt(s.amount)}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-600" /> Saved {fmt(saved)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-200" /> Left {fmt(leftOver)}
        </span>
        <span className="ml-auto text-slate-400">of {fmt(income)} income</span>
      </div>
    </div>
  );
}
