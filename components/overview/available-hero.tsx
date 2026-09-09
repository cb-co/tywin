"use client";

import { useRef, useEffect } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { HeroCard } from "@/components/ui/hero-card";
import { MoneyDisplay } from "@/components/ui/money-display";
import type { Available } from "@/lib/overview/available";

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
}: {
  available: Available;
  netWorth: number;
  currency: string;
}) {
  const t = useTranslations("Overview");
  const f = useFormatter();
  const breakdownRef = useRef<HTMLDivElement>(null);

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
    // (see toggleBreakdown) so opening it never costs a re-render.
    if (breakdownRef.current && window.matchMedia("(max-width: 639px)").matches) {
      breakdownRef.current.hidden = true;
    }
  }, []);

  function toggleBreakdown() {
    if (breakdownRef.current) breakdownRef.current.hidden = !breakdownRef.current.hidden;
  }

  // A negative figure is information ("the period is already over-committed"),
  // not a scolding — so it gets exactly the colour budget bars already use for
  // `over`, and nothing louder.
  const negative = a.available < 0;

  return (
    <HeroCard label={t("availableLabel", { date })}>
      <MoneyDisplay
        amount={a.available}
        currency={currency}
        size="hero"
        animate
        className={negative ? "text-destructive" : undefined}
      />

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
        onClick={toggleBreakdown}
        className="mt-4 text-sm underline decoration-white/40 underline-offset-4 sm:hidden"
      >
        {t("availableBreakdownToggle")}
      </button>

      <div ref={breakdownRef} className="mt-6 space-y-1.5">
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <span className="opacity-80">{t("availableLiquid")}</span>
          <MoneyDisplay amount={a.liquid} currency={currency} size="inline" />
        </div>
        <Row label={t("availableCommitted")} amount={a.committed} currency={currency} />
        <Row label={t("availableCards")} amount={a.cardsMinimum} currency={currency} />
        {a.cardBasis.map((c) => (
          <p key={c.accountId} className="pl-3 text-xs opacity-60">
            {t(c.basis === "minimum" ? "availableBasisMinimum" : "availableBasisFull", {
              name: c.name,
            })}
          </p>
        ))}
        <Row label={t("availableLoans")} amount={a.loans} currency={currency} />
        <Row label={t("availableSubscriptions")} amount={a.subscriptions} currency={currency} />

        <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-white/15 pt-4 text-sm">
          <span className="opacity-80">{t("netWorthSecondary")}</span>
          <MoneyDisplay amount={netWorth} currency={currency} size="stat" />
        </div>
      </div>
    </HeroCard>
  );
}
