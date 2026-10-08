type DatedPeriod = { start_date: string; end_date: string };

/** Today's date in the user's own timezone, as YYYY-MM-DD. Not
 * toISOString(), which is UTC and rolls over to tomorrow every evening in
 * US timezones. */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The period you're actively living in: the most recent one whose pay date
 * (end_date) has already arrived -- not just whichever date range today falls
 * into. A period doesn't become "current" until its own pay date hits, even
 * though the next one's date range technically started the day before. Falls
 * back to the soonest upcoming period, else the most recently started one, so
 * this never throws on an empty or gap-y list. */
export function findCurrentPeriod<T extends DatedPeriod>(periods: T[]): T | undefined {
  const today = todayIso();

  const completed = periods
    .filter((p) => p.end_date <= today)
    .sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
  if (completed) return completed;

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
