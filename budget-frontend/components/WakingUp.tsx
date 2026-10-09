/** Shown while the server is starting back up after being idle (free
 * hosting puts it to sleep), so a slow first load doesn't look broken. */
export default function WakingUp({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />
        Waking up RevBill…
      </span>
    );
  }
  return (
    <main className="max-w-sm mx-auto p-6 mt-24 text-center space-y-4" role="status" aria-live="polite">
      <h1 className="text-2xl font-bold">
        Rev<span className="text-sky-700">Bill</span>
      </h1>
      <div className="mx-auto w-10 h-10 rounded-full border-4 border-sky-100 border-t-sky-700 animate-spin" aria-hidden />
      <div className="space-y-1">
        <p className="text-lg font-semibold text-slate-900">Waking up RevBill…</p>
        <p className="text-sm text-slate-600">
          RevBill is a free product running on free hosting, so it takes a short nap when no one&apos;s using it.
          Waking it back up can take up to a minute. Thanks for your patience!
        </p>
      </div>
    </main>
  );
}
