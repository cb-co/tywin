/** Month helpers — a "month" is a first-of-month string, e.g. "2026-07-01". */

export function monthStart(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function normalizeMonth(input?: string): string {
  if (input && /^\d{4}-\d{2}/.test(input)) {
    const [y, m] = input.split("-").map(Number);
    return `${y}-${String(m).padStart(2, "0")}-01`;
  }
  return monthStart();
}
