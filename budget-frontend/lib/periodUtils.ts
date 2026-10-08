type DatedPeriod = { start_date: string; end_date: string; pay_date?: string | null };

/** The payday a cycle belongs to (its start in the current layout, its end for older cycles). */
export function payDateOf(p: DatedPeriod): string {
  return p.pay_date ?? p.end_date;
}

/** Today's date in the user's own timezone, as YYYY-MM-DD. Not
 * toISOString(), which is UTC and rolls over to tomorrow every evening in
 * US timezones. */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The cycle you're actively living in: the one belonging to the most recent
 * payday that has arrived (matches the server's find_current_period). Among
 * cycles sharing that payday, the latest one that has started wins. Falls back
 * to the soonest upcoming cycle, else the most recently started one, so this
 * never throws on an empty or gap-y list. */
export function findCurrentPeriod<T extends DatedPeriod>(periods: T[]): T | undefined {
  const today = todayIso();

  const started = periods
    .filter((p) => payDateOf(p) <= today && p.start_date <= today)
    .sort((a, b) => payDateOf(b).localeCompare(payDateOf(a)) || b.start_date.localeCompare(a.start_date))[0];
  if (started) return started;

  const upcoming = periods
    .filter((p) => p.start_date >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  if (upcoming) return upcoming;

  return [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
}

/** The cycle right after the current one -- chronologically next by start
 * date, since periods are contiguous and non-overlapping. */
export function findNextPeriod<T extends DatedPeriod>(periods: T[], current: T | undefined): T | undefined {
  if (!current) return undefined;
  return periods
    .filter((p) => p.start_date > current.start_date)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
}
