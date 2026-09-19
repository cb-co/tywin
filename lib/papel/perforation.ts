export function perforationCells(total: number, paid: number, max = 24) {
  if (!Number.isFinite(total) || total <= 0) return { cells: [], hidden: 0 };
  const n = Math.floor(total);
  const p = Math.min(Math.max(Math.floor(paid) || 0, 0), n);
  const drawn = Math.min(n, max);
  return {
    cells: Array.from({ length: drawn }, (_, index) => ({ index, paid: index < p })),
    hidden: n - drawn,
  };
}
