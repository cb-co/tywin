export function meterFill(used: number, total: number) {
  if (!(total > 0)) return { pct: 0, over: false };
  const raw = (used / total) * 100;
  return { pct: Math.min(Math.max(raw, 0), 100), over: raw > 100 };
}
