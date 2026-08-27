type Props = {
  totalIncome: number;
  totalBillsPaid: number;
  totalSaved: number;
  leftOver: number;
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function SummaryPanel({ totalIncome, totalBillsPaid, totalSaved, leftOver }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
        <div className="text-xs text-slate-400">Total Income</div>
        <div className="text-xl font-semibold text-emerald-700">+{fmt(totalIncome)}</div>
      </div>
      <div className="rounded-xl border border-red-200 bg-red-50/30 p-4">
        <div className="text-xs text-slate-400">Total Paid</div>
        <div className="text-xl font-semibold text-red-600">-{fmt(totalBillsPaid)}</div>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
        <div className="text-xs text-slate-400">Saved this period</div>
        <div className="text-xl font-semibold text-emerald-700">{fmt(totalSaved)}</div>
      </div>
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="text-xs text-slate-400">Left</div>
        <div className={`text-xl font-semibold ${leftOver < 0 ? "text-red-600" : "text-emerald-700"}`}>
          {fmt(leftOver)}
        </div>
      </div>
    </div>
  );
}
