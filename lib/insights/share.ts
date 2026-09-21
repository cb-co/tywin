type Slice = { name: string; value: number; color: string; emoji?: string | null };

/** Ledger rows for a spend breakdown. Rows past `max` fold into one trailing
 *  `rest` row (its `name` is left empty for the caller to localise) so the
 *  printed amounts always add up to the total. */
export function shareRows(data: Slice[], total: number, max = 7) {
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  const head = data.slice(0, max).map((s) => ({ ...s, pct: pct(s.value), rest: false }));
  const tail = data.slice(max);
  if (tail.length === 0) return head;
  const value = tail.reduce((sum, s) => sum + s.value, 0);
  return [...head, { name: "", value, color: "var(--muted-foreground)", pct: pct(value), rest: true }];
}
