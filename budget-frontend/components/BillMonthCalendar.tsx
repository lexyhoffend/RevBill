"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BillCalendarEntry, getBillCalendar } from "@/lib/api";

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Local Date() component constructors, never ISO-string parsing -- avoids any
// UTC/local timezone shift on plain YYYY-MM-DD day math.
function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function firstWeekday(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const WEEKDAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Compact month calendar with the same due/overdue/paid status dots as the
 * full Calendar page -- meant to sit in a sticky sidebar next to a scrolling
 * list (e.g. Pay Periods) so the current month is always visible. */
export default function BillMonthCalendar() {
  const [entries, setEntries] = useState<BillCalendarEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const today = todayIso();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [selectedDate, setSelectedDate] = useState<string | null>(today);

  useEffect(() => {
    getBillCalendar()
      .then(setEntries)
      .catch((e) => setError(String(e)));
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, BillCalendarEntry[]>();
    for (const e of entries) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [entries]);

  function statusFor(date: string): "overdue" | "due" | "paid" | null {
    const list = byDate.get(date);
    if (!list || list.length === 0) return null;
    if (list.some((e) => e.is_overdue)) return "overdue";
    if (list.some((e) => !e.is_paid)) return "due";
    return "paid";
  }

  function prevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  }

  const isCurrentMonth = year === Number(today.slice(0, 4)) && month === Number(today.slice(5, 7));

  function goToday() {
    setYear(Number(today.slice(0, 4)));
    setMonth(Number(today.slice(5, 7)));
    setSelectedDate(today);
  }

  const totalDays = daysInMonth(year, month);
  const leadingBlanks = firstWeekday(year, month);
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const selectedEntries = (selectedDate ? byDate.get(selectedDate) : undefined) ?? [];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      {error && <p className="text-red-600 text-xs">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          ‹
        </button>
        <button
          onClick={goToday}
          disabled={isCurrentMonth}
          title="Jump to today"
          className="font-medium text-sm hover:underline disabled:no-underline disabled:cursor-default"
        >
          {MONTH_NAMES[month - 1]} {year}
        </button>
        <button
          onClick={nextMonth}
          className="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400">
        {WEEKDAY_HEADERS.map((d, i) => (
          <div key={i} className="py-0.5">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />;
          const date = isoDate(year, month, day);
          const status = statusFor(date);
          const isToday = date === today;
          const isSelected = date === selectedDate;
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 border transition-colors ${
                isSelected
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                  : isToday
                  ? "border-emerald-300 dark:border-emerald-700"
                  : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span className={isToday ? "font-semibold text-emerald-700 dark:text-emerald-400" : ""}>{day}</span>
              {status && (
                <span
                  className={`w-1 h-1 rounded-full ${
                    status === "overdue" ? "bg-red-600" : status === "due" ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600" /> Overdue
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Due
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Paid
        </span>
      </div>

      {selectedDate && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          <div className="text-xs font-medium text-slate-500">{selectedDate}</div>
          {selectedEntries.length === 0 ? (
            <p className="text-xs text-slate-400">No bills due this day.</p>
          ) : (
            selectedEntries.map((e) => (
              <div key={`${e.bill_source_id}-${e.date}`} className="flex justify-between items-center text-xs gap-2">
                <span className="truncate">{e.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={
                      e.is_paid ? "text-slate-400" : e.is_overdue ? "text-red-600 font-medium" : "text-amber-600"
                    }
                  >
                    {fmt(e.amount)}
                  </span>
                  <Link href={`/period/${e.period_id}`} className="text-emerald-700 dark:text-emerald-400 hover:underline">
                    →
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
