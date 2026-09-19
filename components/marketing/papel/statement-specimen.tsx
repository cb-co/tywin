"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Car,
  Check,
  HeartPulse,
  RotateCcw,
  ShoppingCart,
  Smartphone,
  Sofa,
  Tv,
  type LucideIcon,
} from "lucide-react";
import s from "./papel.module.css";

/* Illustrative data only: labelled on the sheet as made up. The five RD$
   lines add to the printed total, so the "matches the statement" seal is
   true of the example it sits on. */
type Row = {
  date: string;
  raw: string;
  name: string;
  cat: "Groceries" | "Phone" | "Home" | "Transport" | "Health" | "Subs";
  icon: LucideIcon;
  color: string;
  amount: string;
  usd?: boolean;
  cuota?: [number, number];
};

const ROWS: Row[] = [
  { date: "02/09", raw: "SUPERMERCADOS NACIONAL 0217", name: "Supermercados Nacional", cat: "Groceries", icon: ShoppingCart, color: "#0E6E60", amount: "4,382.10" },
  { date: "03/09", raw: "CLARO RECARGA *8093", name: "Claro", cat: "Phone", icon: Smartphone, color: "#1D4FB8", amount: "1,200.00" },
  { date: "05/09", raw: "LA SIRENA CUOTA 04/12", name: "La Sirena", cat: "Home", icon: Sofa, color: "#C4531A", amount: "3,250.00", cuota: [4, 12] },
  { date: "06/09", raw: "UBER *TRIP HELP.UBER", name: "Uber", cat: "Transport", icon: Car, color: "#5B2E91", amount: "486.50" },
  { date: "08/09", raw: "FARMACIA CAROL 0112", name: "Farmacia Carol", cat: "Health", icon: HeartPulse, color: "#A52A2A", amount: "22.50" },
  { date: "10/09", raw: "NETFLIX.COM 866-579", name: "Netflix", cat: "Subs", icon: Tv, color: "#B0144F", amount: "15.49", usd: true },
];

export function StatementSpecimen() {
  const t = useTranslations("Marketing");
  const ref = useRef<HTMLElement>(null);

  /* The finished state is what the server renders, so the specimen reads
     fully before hydration and under reduced motion. Playing it means
     dropping the attribute, forcing a style flush, and setting it again so
     the keyframes restart from the top. */
  const play = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.removeAttribute("data-play");
    void el.offsetWidth;
    el.setAttribute("data-play", "on");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          play();
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [play]);

  return (
    <figure ref={ref} className={s.specimen} aria-label={t("specimenLabel")}>
      <div className={s.statement} aria-hidden>
        <div className={s.statementHead}>
          <span className={s.legend}>{t("statementTitle")}</span>
          <span>{t("statementCard")}</span>
          <span>{t("statementCut")}</span>
        </div>
        <ol className={s.statementRows}>
          {ROWS.map((r, i) => (
            <li key={r.raw} className={s.statementRow} style={{ "--i": i } as React.CSSProperties}>
              <span>{r.date}</span>
              <span className={s.statementRaw}>{r.raw}</span>
              <span className={s.num}>
                {r.usd ? "US$" : ""}
                {r.amount}
              </span>
            </li>
          ))}
        </ol>
        <div className={s.statementTotal}>
          <span>{t("statementTotal")}</span>
          <span className={s.num}>RD$ 9,341.10</span>
          <span className={s.num}>US$ 15.49</span>
        </div>
        <p className={s.sampleTag}>{t("sampleData")}</p>
      </div>

      <div className={s.ledger}>
        <p className={s.ledgerTitle}>{t("ledgerTitle")}</p>
        <ul className={s.ledgerRows}>
          {ROWS.map((r, i) => {
            const Icon = r.icon;
            return (
              <li key={r.raw} className={s.ledgerRow} style={{ "--i": i } as React.CSSProperties}>
                <span className={s.tile} style={{ background: r.color }}>
                  <Icon aria-hidden strokeWidth={2.2} />
                </span>
                <span className={s.ledgerName}>
                  <span>{r.name}</span>
                  <span className={s.ledgerMeta}>
                    {t(`cat${r.cat}`)}
                    {r.cuota ? (
                      <span className={s.cuota}>
                        {t("cuotaBadge", { n: r.cuota[0], total: r.cuota[1] })}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className={s.num}>
                  <span className={s.cur}>{r.usd ? "US$" : "RD$"}</span> {r.amount}
                </span>
              </li>
            );
          })}
        </ul>
        <div className={s.ledgerFoot}>
          <span className={s.seal}>
            <Check aria-hidden strokeWidth={3} />
            {t("balanced")}
          </span>
          <span className={s.safe}>
            <span className={s.safeLabel}>{t("safeLabel")}</span>
            <span className={s.safeFigure}>RD$ 12,480</span>
          </span>
        </div>
      </div>

      <button type="button" className={s.replay} onClick={play}>
        <RotateCcw aria-hidden />
        {t("replay")}
      </button>
    </figure>
  );
}
