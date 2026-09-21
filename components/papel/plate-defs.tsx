import { HATCHES } from "@/lib/papel/plate";

export const PLATE_TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--paper-line)",
  borderRadius: "var(--radius)",
  boxShadow: "none",
  fontSize: 12,
} as const;

export const PLATE_AXIS = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false } as const;
export const PLATE_GRID = { stroke: "var(--paper-line)", vertical: false } as const;

/** Hatch fills for a Recharts `<svg>`: `fill="url(#plate-N)"`, N = chart slot.
 *  Slot 4 also gets a crossing rule so cash-flow's two bars differ by more
 *  than angle alone. Identical ids on one page carry identical content. */
export function PlateDefs() {
  return (
    <defs>
      {HATCHES.map((h, i) => {
        const n = i + 1;
        return (
          <pattern key={n} id={`plate-${n}`} width={h.gap} height={h.gap} patternUnits="userSpaceOnUse" patternTransform={`rotate(${h.angle})`}>
            <line x1={h.gap / 2} y1="0" x2={h.gap / 2} y2={h.gap} stroke={`var(--chart-${n})`} strokeWidth={1.25} />
            {n === 4 ? <line x1="0" y1={h.gap / 2} x2={h.gap} y2={h.gap / 2} stroke={`var(--chart-${n})`} strokeWidth={1.25} /> : null}
          </pattern>
        );
      })}
    </defs>
  );
}
