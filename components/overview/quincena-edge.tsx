"use client";

import { useTranslations, useFormatter } from "next-intl";
import { periodProgress } from "@/lib/overview/period-progress";

/** The quincena engraved along the note's bottom edge: period start, today,
 *  payday. One image for assistive tech (`aria-label`), so the ticks and
 *  captions are decoration. Ink is `currentColor` and the today marker is a
 *  tall tick plus a caption, never colour alone. */
export function QuincenaEdge({ start, end, today }: { start: string; end: string; today: string }) {
  const t = useTranslations("Overview");
  const f = useFormatter();
  const { day, total, pos } = periodProgress({ start, end }, today);
  const short = (iso: string) =>
    f.dateTime(new Date(`${iso}T00:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div role="img" aria-label={t("quincenaEdgeLabel", { day, total, date: short(end) })} className="relative mt-6">
      <div aria-hidden className="relative h-3 border-b border-current">
        {Array.from({ length: total }, (_, i) => (
          <i
            key={i}
            className="absolute bottom-0 w-px bg-current opacity-60"
            style={{ left: `${total > 1 ? (i / (total - 1)) * 100 : 0}%`, height: i === 0 || i === total - 1 ? "0.75rem" : "0.375rem" }}
          />
        ))}
        <i className="absolute bottom-0 h-5 w-0.5 bg-current" style={{ left: `${pos * 100}%` }} />
      </div>
      <div aria-hidden className="legend mt-1.5 flex justify-between text-[10px]">
        <span>{short(start)}</span>
        <span>{short(end)}</span>
      </div>
      <span
        aria-hidden
        className="legend absolute -top-1 -translate-x-1/2 text-[10px]"
        style={{ left: `${pos * 100}%` }}
      >
        {t("quincenaToday")}
      </span>
    </div>
  );
}
