const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Local-timezone calendar date as 'YYYY-MM-DD' (visitDate precision).

 * `new Date().toISOString()` returns the UTC date, which is one day behind the
 * local calendar date between 00:00 and ~07:00 in UTC+7 (VN). The past-date
 * warning (A5) and seed dates must use local day precision or they misfire. */
export function localISODate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return fmt(d);
}

/** Returns the Monday–Sunday range of the current local week as YYYY-MM-DD. */
export function localWeekRange(): { start: string; end: string } {
  const d = new Date();
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: fmt(monday), end: fmt(sunday) };
}