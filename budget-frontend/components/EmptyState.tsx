function Calendar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" fill="#7F77DD" />
      <rect x="3" y="5" width="18" height="4.5" rx="2" fill="#3C3489" fillOpacity={0.55} />
      <rect x="7" y="2" width="2" height="4" rx="1" fill="#3C3489" />
      <rect x="15" y="2" width="2" height="4" rx="1" fill="#3C3489" />
      <rect x="6" y="12" width="3" height="3" rx="0.6" fill="#3C3489" fillOpacity={0.4} />
      <rect x="10.5" y="12" width="3" height="3" rx="0.6" fill="#3C3489" fillOpacity={0.4} />
      <rect x="15" y="12" width="3" height="3" rx="0.6" fill="#3C3489" fillOpacity={0.4} />
      <rect x="6" y="16.5" width="3" height="3" rx="0.6" fill="#3C3489" fillOpacity={0.4} />
      <rect x="10.5" y="16.5" width="3" height="3" rx="0.6" fill="#3C3489" fillOpacity={0.4} />
    </svg>
  );
}

function PiggyBank({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M14 7.2 16 4.4l1.1 3.6Z" fill="#D4537E" />
      <ellipse cx="10.8" cy="13" rx="8.3" ry="6" fill="#D4537E" />
      <circle cx="19" cy="12.3" r="2.2" fill="#D4537E" />
      <circle cx="20.2" cy="11.9" r="0.45" fill="#72243E" fillOpacity={0.55} />
      <rect x="5" y="18" width="2" height="3" rx="1" fill="#D4537E" />
      <rect x="13.5" y="18" width="2" height="3" rx="1" fill="#D4537E" />
      <rect x="9" y="7.4" width="3.2" height="1.4" rx="0.7" fill="#72243E" fillOpacity={0.55} />
      <circle cx="6.5" cy="12.5" r="1" fill="#72243E" fillOpacity={0.55} />
    </svg>
  );
}

const ILLUSTRATIONS: Record<string, (props: { className?: string }) => React.ReactElement> = {
  calendar: Calendar,
  piggybank: PiggyBank,
};

/** A friendly illustrated empty state -- replaces a plain "nothing here yet"
 * line with a small two-tone illustration matching the bill category icons,
 * a heading, and an optional next-step action. */
export default function EmptyState({
  illustration,
  title,
  subtitle,
  action,
}: {
  illustration: "calendar" | "piggybank";
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const Illustration = ILLUSTRATIONS[illustration];
  return (
    <div className="flex flex-col items-center text-center gap-2 py-10 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
      <Illustration className="w-14 h-14" />
      <div className="text-sm font-medium">{title}</div>
      {subtitle && <div className="text-xs text-slate-400 max-w-xs">{subtitle}</div>}
      {action}
    </div>
  );
}
