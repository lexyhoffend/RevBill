"use client";

import { useEffect, useRef, useState } from "react";

export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label="More info"
        aria-expanded={open}
        className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 text-[9px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-400 leading-none shrink-0"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-20 left-1/2 -translate-x-1/2 top-full mt-1.5 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs font-normal normal-case tracking-normal text-slate-600 dark:text-slate-300 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
