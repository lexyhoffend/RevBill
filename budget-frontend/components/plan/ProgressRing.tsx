/** "$1,450 of $2,000 managed" ring. The fill animates only upward (motion is
 * for wins), and the label always states the numbers in words too. */
export default function ProgressRing({ managed, total, size = 132 }: { managed: number; total: number; size?: number }) {
  const pct = total > 0 ? Math.min(managed / total, 1) : 0;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const done = pct >= 0.9999;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(pct * 100)}% managed`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={done ? "#16a34a" : "#0369a1"}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 600ms ease-out" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-slate-800" fontSize={size / 5} fontWeight={700}>
        {done ? "✓" : `${Math.round(pct * 100)}%`}
      </text>
    </svg>
  );
}
