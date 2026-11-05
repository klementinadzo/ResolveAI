/* ---------- Dates ----------
 * Ranking, renewal proximity, overdue checks and default due dates use the real
 * current day (local calendar date), recalculated on every call, so they stay
 * correct as days pass. Saved records carry real timestamps (set by the database).
 */

export const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Parses a calendar date ("2026-10-06") or a timestamp ("2026-10-06T12:00:00+00:00") as a local calendar day. */
export const parseIso = (s: string) => {
  if (s.length > 10) {
    const d = new Date(s);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const [y = 0, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Today's local calendar date (midnight). */
export const today = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/** Whole days from today to the given date (negative = in the past). */
export const daysUntil = (iso: string) =>
  Math.round((parseIso(iso).getTime() - today().getTime()) / 86400000);

export const fmtDate = (iso: string) =>
  parseIso(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function addBusinessDays(from: Date, n: number) {
  const d = new Date(from);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d;
}

/** "1 day" / "3 days". */
export const dayCount = (n: number) => `${n} ${Math.abs(n) === 1 ? "day" : "days"}`;
