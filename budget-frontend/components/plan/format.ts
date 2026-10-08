/** Dollars for plan screens: whole amounts without cents, otherwise two decimals. */
export function money(n: number): string {
  const whole = Math.abs(n % 1) < 0.005;
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}

/** "Oct 12" from a YYYY-MM-DD string, without Date parsing (no timezone shift). */
export function shortDate(iso: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
}
