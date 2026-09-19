"use client";

import { useId, useRef, useEffect } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Note } from "@/components/papel/note";
import { ProofMark } from "@/components/papel/proof-mark";
import { QuincenaEdge } from "@/components/overview/quincena-edge";
import { MoneyDisplay } from "@/components/ui/money-display";
import type { Available } from "@/lib/overview/available";
import { periodSerial } from "@/lib/overview/period-serial";
import { fitFigureClass } from "@/lib/papel/fit";
import { formatMoney } from "@/lib/format";
import type { Period } from "@/lib/period/cycle";
import { cn } from "@/lib/utils";

function Row({
  label,
  amount,
  currency,
  negate = true,
}: {
  label: string;
  amount: number;
  currency: string;
  negate?: boolean;
}) {
  // A zero line (no committed goals, no card debt, no loans) is not a fact
  // worth a row — it would just be noise under the figure that matters.
  if (amount === 0) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="opacity-80">{label}</span>
      <MoneyDisplay amount={negate ? -amount : amount} currency={currency} size="inline" />
    </div>
  );
}

/**
 * "Disponible hasta el <payday>" — the Overview hero. Replaces net worth as
 * the figure people actually check: not what they're worth, but what's left
 * before the next quincenal payday. Net worth survives as a secondary stat
 * inside the same card, not removed.
 */
export function AvailableHero({
  available: a,
  netWorth,
  currency,
  period,
  today,
}: {
  available: Available;
  netWorth: number;
  currency: string;
  period: Period;
  today: string;
}) {
  const t = useTranslations("Overview");
  const f = useFormatter();
  const breakdownRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const breakdownId = useId();

  // Interpolated, never concatenated: es and en order the date differently.
  const date = f.dateTime(new Date(`${a.periodEnd}T00:00:00Z`), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  useEffect(() => {
    // Collapsed by default only below `sm`, set once on mount rather than
    // watched on resize — someone widening the window mid-glance is not a
    // case worth chasing. Toggled straight through the DOM node afterward
    // (see toggleBreakdown) so opening it never costs a re-render. Net worth
    // is a sibling of this element, not a child — it must stay visible at
    // every width, so it is deliberately outside what this collapses.
    if (breakdownRef.current && window.matchMedia("(max-width: 639px)").matches) {
      breakdownRef.current.hidden = true;
      toggleRef.current?.setAttribute("aria-expanded", "false");
    }
  }, []);

  function toggleBreakdown() {
    const el = breakdownRef.current;
    if (!el) return;
    el.hidden = !el.hidden;
    // Kept in sync by hand alongside `el.hidden` rather than from React state,
    // for the same no-re-render reason the disclosure itself avoids state.
    toggleRef.current?.setAttribute("aria-expanded", String(!el.hidden));
  }

  // A negative figure is information ("the period is already over-committed"),
  // not a scolding — so it gets exactly the colour budget bars already use for
  // `over`, and nothing louder.
  const negative = a.available < 0;

  const figureClass = cn(
    fitFigureClass(formatMoney(a.available, currency)),
    "[font-stretch:125%] font-extrabold",
  );

  return (
    <Note tone="peso" label={t("availableLabel", { date })} serial={periodSerial(period.start)}>
      {negative ? (
        <div className="inline-block max-w-full rounded-[3px] bg-(--paper-2) px-3 py-2 text-(--red)">
          <MoneyDisplay amount={a.available} currency={currency} size="hero" animate className={figureClass} />
          <ProofMark tone="flag" className="mt-1 block">
            {t("availableOver")}
          </ProofMark>
        </div>
      ) : (
        <MoneyDisplay amount={a.available} currency={currency} size="hero" animate className={figureClass} />
      )}

      {/* Only when the two card bases actually differ — with no card debt, or
          every card at a clamped-to-zero minimum, they land within a cent of
          each other after FX conversion, and printing that twice reads as a
          rendering bug rather than a real second number. */}
      {Math.abs(a.cardsFull - a.cardsMinimum) >= 0.01 ? (
        <p className="mt-1 text-sm opacity-70">
          {t.rich("availableIfCleared", {
            amount: () => (
              <MoneyDisplay amount={a.availableIfCardsCleared} currency={currency} size="inline" />
            ),
          })}
        </p>
      ) : null}

      <button
        type="button"
        ref={toggleRef}
        onClick={toggleBreakdown}
        aria-expanded="true"
        aria-controls={breakdownId}
        className="mt-4 block text-sm underline decoration-current/40 underline-offset-4 sm:hidden"
      >
        {t("availableBreakdownToggle")}
      </button>

      <div id={breakdownId} ref={breakdownRef} className="mt-6 space-y-1.5">
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <span className="opacity-80">{t("availableLiquid")}</span>
          <MoneyDisplay amount={a.liquid} currency={currency} size="inline" />
        </div>
        <Row label={t("availableCommitted")} amount={a.committed} currency={currency} />
        {/* Exempt from the zero-suppression every other row uses: computeAvailable
            clamps a card's contribution to `Math.min(minimum, due)`, so a card with
            a legitimate $0 printed minimum on a nonzero balance sums to 0 here even
            though it is genuinely owed. cardBasis is populated for every card with
            a nonzero due regardless of its minimum, so gate this unit on that list
            being non-empty — not on the amount — or the basis lines below end up
            floating with no header explaining what they're footnoting. */}
        {a.cardBasis.length > 0 ? (
          <>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="opacity-80">{t("availableCards")}</span>
              <MoneyDisplay amount={-a.cardsMinimum} currency={currency} size="inline" />
            </div>
            {a.cardBasis.map((c) => (
              <p key={c.accountId} className="pl-3 text-xs opacity-60">
                {t(c.basis === "minimum" ? "availableBasisMinimum" : "availableBasisFull", {
                  name: c.name,
                })}
              </p>
            ))}
          </>
        ) : null}
        <Row label={t("availableLoans")} amount={a.loans} currency={currency} />
        <Row label={t("availableSubscriptions")} amount={a.subscriptions} currency={currency} />
      </div>

      {/* A sibling of the collapsible breakdown, not a child of it: net worth
          is demoted, not removed, and must stay visible at every width — the
          returning user's anchor while the hero above it changes meaning. */}
      <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-current/20 pt-4 text-sm">
        <span className="opacity-80">{t("netWorthSecondary")}</span>
        <MoneyDisplay amount={netWorth} currency={currency} size="stat" />
      </div>

      <QuincenaEdge start={period.start} end={period.end} today={today} />
    </Note>
  );
}
