import { BillEntry } from "@/lib/api";
import InfoTooltip from "@/components/InfoTooltip";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function OweBalancesPanel({ billEntries }: { billEntries: BillEntry[] }) {
  const revolving = billEntries.filter((b) => b.is_revolving && b.owed_balance > 0);
  if (revolving.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4">
      <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
        Owed (carried forward)
        <InfoTooltip text="The standing balance left on this revolving bill after every payment made against it so far -- not a fresh charge each cycle, so a cycle where nothing gets paid just leaves it where it was." />
      </div>
      <div className="space-y-1">
        {revolving.map((b) => (
          <div key={b.id} className="flex justify-between text-sm">
            <span>{b.source_name}</span>
            <span className="font-semibold text-amber-700 dark:text-amber-400">{fmt(b.owed_balance)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
