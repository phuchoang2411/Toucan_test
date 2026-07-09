/** Local-timezone calendar date as 'YYYY-MM-DD' (visitDate precision).

 * `new Date().toISOString()` returns the UTC date, which is one day behind the
 * local calendar date between 00:00 and ~07:00 in UTC+7 (VN). The past-date
 * warning (A5) and seed dates must use local day precision or they misfire. */
export function localISODate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}