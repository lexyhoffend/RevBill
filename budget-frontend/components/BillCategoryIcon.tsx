type IconProps = { mid: string; dark: string; className?: string };

function Rent({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M4 11l8-7 8 7v10H4Z" fill={mid} />
      <rect x="10.5" y="14" width="3" height="6" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function Energy({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        d="M12 3a6 6 0 0 0-3.5 10.9c.6.44 1 .95 1.1 1.6h4.8c.1-.65.5-1.16 1.1-1.6A6 6 0 0 0 12 3Z"
        fill={mid}
      />
      <rect x="9.3" y="16.8" width="5.4" height="1.5" rx="0.5" fill={mid} />
      <rect x="9.8" y="18.8" width="4.4" height="1.3" rx="0.5" fill={mid} />
      <rect x="10.3" y="20.6" width="3.4" height="1.1" rx="0.5" fill={mid} />
      <ellipse cx="10.2" cy="9.2" rx="0.9" ry="2.6" transform="rotate(-18 10.2 9.2)" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function Water({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11Z" fill={mid} />
      <ellipse cx="10" cy="13" rx="1" ry="2.2" transform="rotate(-10 10 13)" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function Trash({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="9" y="3.5" width="6" height="2" rx="1" fill={mid} />
      <rect x="4" y="6" width="16" height="2" rx="1" fill={mid} />
      <path d="M6 8.5 7 20.5a1 1 0 0 0 1 0.9h8a1 1 0 0 0 1-0.9L18 8.5Z" fill={mid} />
      <rect x="10.3" y="11" width="1.4" height="7" rx="0.6" fill={dark} fillOpacity={0.55} />
      <rect x="13.7" y="11" width="1.4" height="7" rx="0.6" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function Wifi({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="3" y="13" width="18" height="6" rx="2" fill={mid} />
      <path d="M7 13 5 8l4 5Z" fill={mid} />
      <path d="M17 13 19 8l-4 5Z" fill={mid} />
      <circle cx="7" cy="16" r="1" fill={dark} fillOpacity={0.55} />
      <circle cx="11" cy="16" r="1" fill={dark} fillOpacity={0.55} />
      <circle cx="15" cy="16" r="1" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function Phone({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="7" y="2" width="10" height="20" rx="2" fill={mid} />
      <rect x="8.3" y="4.3" width="7.4" height="13" rx="0.8" fill={dark} fillOpacity={0.55} />
      <rect x="10.5" y="18.3" width="3" height="1.3" rx="0.6" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function Tv({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="3" y="5" width="18" height="13" rx="2" fill={mid} />
      <rect x="9" y="19.5" width="6" height="1.6" rx="0.8" fill={mid} />
      <rect x="5" y="7" width="14" height="9" rx="1" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function Building({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="5" y="3" width="14" height="18" rx="1" fill={mid} />
      <rect x="8" y="7" width="2" height="2" fill={dark} fillOpacity={0.55} />
      <rect x="14" y="7" width="2" height="2" fill={dark} fillOpacity={0.55} />
      <rect x="8" y="11" width="2" height="2" fill={dark} fillOpacity={0.55} />
      <rect x="14" y="11" width="2" height="2" fill={dark} fillOpacity={0.55} />
      <rect x="8" y="15" width="2" height="2" fill={dark} fillOpacity={0.55} />
      <rect x="14" y="15" width="2" height="2" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function Car({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M7 11 9 7h6l2 4Z" fill={mid} />
      <rect x="3" y="11" width="18" height="4" rx="1.5" fill={mid} />
      <circle cx="7.5" cy="16.5" r="1.7" fill={dark} fillOpacity={0.55} />
      <circle cx="16.5" cy="16.5" r="1.7" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function Shield({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" fill={mid} />
      <circle cx="12" cy="11" r="2.2" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function Lock({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" fill={mid} />
      <path d="M8 11V8a4 4 0 0 1 8 0v3h-2V8a2 2 0 0 0-4 0v3Z" fill={dark} fillOpacity={0.55} />
      <circle cx="12" cy="15" r="1.3" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function Subscription({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a1.5 1.5 0 0 0 0 3v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a1.5 1.5 0 0 0 0-3Z"
        fill={mid}
      />
      <rect x="11.2" y="6" width="1.6" height="2" rx="0.6" fill={dark} fillOpacity={0.55} />
      <rect x="11.2" y="10" width="1.6" height="2" rx="0.6" fill={dark} fillOpacity={0.55} />
      <rect x="11.2" y="14" width="1.6" height="2" rx="0.6" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function Dumbbell({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="6.2" y="8" width="1.8" height="8" rx="0.9" fill={mid} />
      <rect x="16" y="8" width="1.8" height="8" rx="0.9" fill={mid} />
      <rect x="3.2" y="10" width="1.6" height="4" rx="0.8" fill={mid} />
      <rect x="19.2" y="10" width="1.6" height="4" rx="0.8" fill={mid} />
      <rect x="8" y="11" width="8" height="2" rx="1" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function Banknote({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" fill={mid} />
      <circle cx="12" cy="12" r="3" fill={dark} fillOpacity={0.55} />
      <circle cx="6" cy="9" r="1" fill={dark} fillOpacity={0.55} />
      <circle cx="18" cy="15" r="1" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function GradCap({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M2 9l10-5 10 5-10 5-10-5Z" fill={mid} />
      <rect x="6" y="12" width="12" height="4" rx="2" fill={dark} fillOpacity={0.55} />
      <circle cx="19" cy="10" r="1" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function CreditCard({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" fill={mid} />
      <rect x="2" y="9" width="20" height="2.4" fill={dark} fillOpacity={0.55} />
      <rect x="6" y="14" width="4" height="1.6" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

function Tag({ mid, dark, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M12 2l9 9-9 9-9-9V4a2 2 0 0 1 2-2h7Z" fill={mid} />
      <circle cx="7.5" cy="7.5" r="1.2" fill={dark} fillOpacity={0.55} />
    </svg>
  );
}

const SHAPES: Record<string, (props: IconProps) => React.ReactElement> = {
  Energy,
  Water,
  "Garbage/Trash": Trash,
  Internet: Wifi,
  "Cell Phone": Phone,
  "Cable/TV": Tv,
  Rent,
  Mortgage: Building,
  "Car Payment": Car,
  Insurance: Shield,
  "Security System": Lock,
  Subscription,
  Gym: Dumbbell,
  Loan: Banknote,
  "Student Loan": GradCap,
  "Credit Card": CreditCard,
  Other: Tag,
};

// Two colors per category -- a mid tone for the icon's main shape, a darker
// tone (at reduced opacity) for the accent details -- rather than one flat
// stroke color for every category.
const COLORS: Record<string, { mid: string; dark: string }> = {
  Energy: { mid: "#EF9F27", dark: "#633806" },
  Water: { mid: "#378ADD", dark: "#0C447C" },
  "Garbage/Trash": { mid: "#888780", dark: "#444441" },
  Internet: { mid: "#1D9E75", dark: "#085041" },
  "Cell Phone": { mid: "#639922", dark: "#27500A" },
  "Cable/TV": { mid: "#D85A30", dark: "#712B13" },
  Rent: { mid: "#7F77DD", dark: "#3C3489" },
  Mortgage: { mid: "#D4537E", dark: "#72243E" },
  "Car Payment": { mid: "#E24B4A", dark: "#791F1F" },
  Insurance: { mid: "#EF9F27", dark: "#633806" },
  "Security System": { mid: "#888780", dark: "#444441" },
  Subscription: { mid: "#D85A30", dark: "#712B13" },
  Gym: { mid: "#D4537E", dark: "#72243E" },
  Loan: { mid: "#639922", dark: "#27500A" },
  "Student Loan": { mid: "#378ADD", dark: "#0C447C" },
  "Credit Card": { mid: "#7F77DD", dark: "#3C3489" },
  Other: { mid: "#888780", dark: "#444441" },
};

const FALLBACK = { mid: "#888780", dark: "#444441" };

function darken(hex: string, factor: number): string {
  const n = hex.replace("#", "");
  const channel = (offset: number) => Math.round(parseInt(n.substring(offset, offset + 2), 16) * factor);
  return `#${[channel(0), channel(2), channel(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Two-tone illustrative icon per bill category (no icon library) -- a main
 * colored shape plus a darker accent for interior detail, falling back to a
 * generic tag for anything unrecognized. Pass `color` to override the default
 * per-category palette -- e.g. to match a pie chart slice's own color instead,
 * so the icon doubles as that legend's color key. */
export default function BillCategoryIcon({
  category,
  className = "w-4 h-4",
  color,
}: {
  category: string;
  className?: string;
  color?: string;
}) {
  const Icon = SHAPES[category] ?? Tag;
  const colors = color ? { mid: color, dark: darken(color, 0.55) } : COLORS[category] ?? FALLBACK;
  return <Icon mid={colors.mid} dark={colors.dark} className={className} />;
}
