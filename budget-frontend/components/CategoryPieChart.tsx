"use client";

const COLORS = [
  "#059669", // emerald-600
  "#2563eb", // blue-600
  "#d97706", // amber-600
  "#dc2626", // red-600
  "#7c3aed", // violet-600
  "#0891b2", // cyan-600
  "#db2777", // pink-600
  "#65a30d", // lime-600
  "#4f46e5", // indigo-600
  "#ea580c", // orange-600
];

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type Slice = { label: string; value: number };

export default function CategoryPieChart({
  slices,
  ariaLabel = "Bill spend by category",
  renderIcon,
}: {
  slices: Slice[];
  ariaLabel?: string;
  renderIcon?: (label: string, color: string) => React.ReactNode;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;

  let cumulative = 0;
  const stops = slices.map((s, i) => {
    const start = (cumulative / total) * 360;
    cumulative += s.value;
    const end = (cumulative / total) * 360;
    return `${COLORS[i % COLORS.length]} ${start}deg ${end}deg`;
  });

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div
        className="w-32 h-32 rounded-full shrink-0"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
        role="img"
        aria-label={ariaLabel}
      />
      <div className="space-y-1 text-sm min-w-40">
        {slices.map((s, i) => {
          const color = COLORS[i % COLORS.length];
          return (
            <div key={s.label} className="flex items-center gap-2">
              {renderIcon ? (
                renderIcon(s.label, color)
              ) : (
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              )}
              <span className="flex-1">{s.label}</span>
              <span className="text-slate-500">
                {fmt(s.value)} · {Math.round((s.value / total) * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
