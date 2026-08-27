"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BillCalendarEntry, getBillCalendar } from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";
import RequirePayCycle from "@/components/RequirePayCycle";
import DashboardHeader from "@/components/DashboardHeader";
import InfoTooltip from "@/components/InfoTooltip";

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

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarPage() {
  return (
    <RequireAuth>
      <RequirePayCycle>
        <CalendarContent />
      </RequirePayCycle>
    </RequireAuth>
  );
}

function CalendarContent() {
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

  const totalDays = daysInMonth(year, month);
  const leadingBlanks = firstWeekday(year, month);
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const selectedEntries = (selectedDate ? byDate.get(selectedDate) : undefined) ?? [];

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <DashboardHeader active="/calendar" />

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="space-y-3">
        <h2 className="font-semibold flex items-center gap-1">
          Calendar
          <InfoTooltip text="Shows the real due date for every bill you've set a 'due day' on (Setup > Bills). Bills without a due day set won't appear here -- add one to see them." />
        </h2>

        <div className="flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ‹
          </button>
          <div className="font-medium">
            {MONTH_NAMES[month - 1]} {year}
          </div>
          <button
            onClick={nextMonth}
            className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
          {WEEKDAY_HEADERS.map((d) => (
            <div key={d} className="py-1">
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
                className={`aspect-square rounded-lg text-sm flex flex-col items-center justify-center gap-1 border transition-colors ${
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
                    className={`w-1.5 h-1.5 rounded-full ${
                      status === "overdue" ? "bg-red-600" : status === "due" ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-600" /> Overdue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Due
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Paid
          </span>
        </div>
      </div>

      {selectedDate && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
          <div className="text-sm font-medium">Bills due {selectedDate}</div>
          {selectedEntries.length === 0 ? (
            <p className="text-sm text-slate-400">No bills due this day.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {selectedEntries.map((e) => (
                <div
                  key={`${e.bill_source_id}-${e.period_id}`}
                  className="flex justify-between items-center py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {e.name}
                      {e.is_overdue && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide font-semibold text-white bg-red-600 rounded-full px-1.5 py-0.5">
                          Overdue
                        </span>
                      )}
                      {e.is_paid && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full px-1.5 py-0.5">
                          Paid
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">{e.category}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={e.is_paid ? "text-slate-400" : "text-red-600 font-medium"}>{fmt(e.amount)}</span>
                    <Link
                      href={`/period/${e.period_id}`}
                      className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      View cycle →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
