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
      <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
        <div className="text-xs text-slate-400">Total Income</div>
        <div className="text-xl font-semibold text-sky-700">+{fmt(totalIncome)}</div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-xs text-slate-400">Total Paid</div>
        <div className="text-xl font-semibold text-slate-800">-{fmt(totalBillsPaid)}</div>
      </div>
      <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4">
        <div className="text-xs text-slate-400">Saved this period</div>
        <div className="text-xl font-semibold text-sky-700">{fmt(totalSaved)}</div>
      </div>
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="text-xs text-slate-400">Left</div>
        <div className={`text-xl font-semibold ${leftOver < 0 ? "text-amber-700" : "text-sky-700"}`}>
          {fmt(leftOver)}
        </div>
      </div>
    </div>
  );
}
