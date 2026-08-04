/** Month helpers — a "month" is a first-of-month string, e.g. "2026-07-01". */

export function monthStart(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function monthLabel(month: string, locale = "en-US"): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

/** "Jul" — axis-sized label for a month. */
export function shortMonth(month: string, locale = "en-US"): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "short" });
}

/** Last calendar day of `month`, as "YYYY-MM-DD". */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

export function normalizeMonth(input?: string): string {
  if (input && /^\d{4}-\d{2}/.test(input)) {
    const [y, m] = input.split("-").map(Number);
    return `${y}-${String(m).padStart(2, "0")}-01`;
  }
  return monthStart();
}

/** Whole months from one first-of-month string to another. Signed. */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
