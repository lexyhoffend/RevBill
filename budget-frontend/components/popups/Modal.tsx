"use client";

/** Centered pop-up over a dimmed page. There's no close-on-backdrop: each
 * pop-up is closed by its own button. Scrolls inside on short screens. */
export default function Modal({ labelledBy, children }: { labelledBy: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-6 space-y-5"
      >
        {children}
      </div>
    </div>
  );
}
