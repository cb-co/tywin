import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { archivo } from "./papel/fonts";
import { Guilloche } from "@/components/papel/guilloche";
import { LocaleToggle } from "./papel/locale-toggle";
import { Microprint, Serial } from "@/components/papel/microprint";
import { StatementSpecimen } from "./papel/statement-specimen";
import s from "./papel/papel.module.css";

/* Direction contract, emitted into the markup so it survives the build. */
const CONTRACT = `<!--
THESIS: Money's own print language. The statement is re-issued as an engraved, checkable document; refuses the headline + phone mockup + feature-card grid.
OWN-WORLD: RD$50-note violet field, peso orange, intaglio ink on lilac security paper; live guilloche rosettes and wave fields, bilingual microprint frames, serial numbers; Archivo expanded caps and tabular numerals, one family; state as ink density.
STORY: A Dominican visitor sees their own estado de cuenta become a sorted ledger with cuotas and one Disponible figure, believes it reads their bank without typing, and creates a free account.
FIRST VIEWPORT: Full-bleed violet note inside a microprint frame; two-line expanded headline left with Create account CTA; statement sheet under a ledger sheet right, printing row by row over a rosette.
FORM: Papel Moneda (banknote security print), candidate 3 of 7, seed 101aa86f.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`;

const BILLS = [
  { day: 21, label: "Claro", amount: "1,200" },
  { day: 25, label: "La Sirena · 5/12", amount: "3,250" },
  { day: 27, label: "Netflix", amount: "US$15.49" },
];

const CUOTAS = [
  { name: "La Sirena", item: "cuotaItemFridge" as const, n: 4, total: 12, amount: "RD$ 3,250.00" },
  { name: "Plaza Lama", item: "cuotaItemLaptop" as const, n: 9, total: 18, amount: "US$ 62.50" },
];

/** Public, unauthenticated home page. Google's OAuth verification and any
 *  signed-out visitor land here, so it has to explain what Cashly does on
 *  its own — it can't assume the reader already knows. */
export async function MarketingHome() {
  const t = await getTranslations("Marketing");
  const micro = t("microprint");

  return (
    <div className={`${s.page} ${archivo.variable}`}>
      <div hidden dangerouslySetInnerHTML={{ __html: CONTRACT }} />
      <main>
      {/* ── The note ─────────────────────────────────────────────── */}
      <section className={s.hero} aria-labelledby="hero-title">
        <Guilloche className={s.heroRosette} />
        <Guilloche variant="field" className={s.heroField} lineWidth={0.6} duration={2400} />
        <Microprint text={micro} />
        <Serial value="CL 2026 000417 A" className={s.serialTop} />
        <Serial value="CL 2026 000417 A" className={s.serialBottom} />

        <nav className={s.nav} aria-label={t("navLabel")}>
          <Link href="/" className={s.brand}>
            <Logo />
            <span>Cashly</span>
          </Link>
          <div className={s.navEnd}>
            <LocaleToggle />
            <Link href="/login" className={s.navLink}>
              {t("logIn")}
            </Link>
          </div>
        </nav>

        <div className={s.heroGrid}>
          <div className={s.heroCopy}>
            <h1 id="hero-title" className={s.display}>
              <span>{t("heroTitleA")}</span> <span className={s.displayB}>{t("heroTitleB")}</span>
            </h1>
            <p className={s.lede}>{t("heroBody")}</p>
            <div className={s.actions}>
              <Link href="/login?mode=up" className={s.cta}>
                {t("getStarted")}
                <ArrowRight aria-hidden />
              </Link>
              <Link href="/login" className={s.quiet}>
                {t("haveAccount")}
              </Link>
            </div>
          </div>
          <StatementSpecimen />
        </div>
      </section>

        {/* ── Reverse of the note: how it reads ─────────────────────── */}
        <section className={s.paper} aria-labelledby="read-title">
          <div className={s.wrap}>
            <div className={s.sectionHead}>
              <h2 id="read-title" className={s.h2}>
                {t("readTitle")}
              </h2>
              <p className={s.sectionBody}>{t("readBody")}</p>
            </div>

            <div className={s.proofs}>
              <article className={s.proof}>
                <div className={s.proofDemo} aria-hidden>
                  <div className={s.columnsDemo}>
                    <span>
                      05/09<i>{t("colDate")}</i>
                    </span>
                    <span>
                      LA SIRENA CUOTA 04/12<i>{t("colDesc")}</i>
                    </span>
                    <span className={s.num}>
                      3,250.00<i>{t("colAmount")}</i>
                    </span>
                  </div>
                </div>
                <h3 className={s.h3}>{t("col1Title")}</h3>
                <p>{t("col1Body")}</p>
              </article>

              <article className={s.proof}>
                <div className={s.proofDemo} aria-hidden>
                  <dl className={s.redactDemo}>
                    <div>
                      <dt>{t("redactName")}</dt>
                      <dd>
                        <b />
                      </dd>
                    </div>
                    <div>
                      <dt>{t("redactEmail")}</dt>
                      <dd>
                        <b style={{ width: "72%" }} />
                      </dd>
                    </div>
                    <div>
                      <dt>{t("redactPhone")}</dt>
                      <dd>
                        <b style={{ width: "46%" }} />
                      </dd>
                    </div>
                  </dl>
                </div>
                <h3 className={s.h3}>{t("col2Title")}</h3>
                <p>{t("col2Body")}</p>
              </article>

              <article className={s.proof}>
                <div className={s.proofDemo} aria-hidden>
                  <dl className={s.sumDemo}>
                    <div>
                      <dt>{t("demoSum")}</dt>
                      <dd className={s.num}>9,341.10</dd>
                    </div>
                    <div>
                      <dt>{t("demoTotal")}</dt>
                      <dd className={s.num}>9,341.10</dd>
                    </div>
                    <div className={s.sumRule}>
                      <dt>{t("demoDiff")}</dt>
                      <dd className={s.num}>
                        0.00 <Check aria-hidden strokeWidth={3} />
                      </dd>
                    </div>
                  </dl>
                </div>
                <h3 className={s.h3}>{t("col3Title")}</h3>
                <p>{t("col3Body")}</p>
              </article>
            </div>
            <p className={s.note}>{t("pdfNote")}</p>
          </div>
        </section>

        {/* ── Disponible: the one number, on the peso-orange note ───── */}
        <section className={s.peso} aria-labelledby="quincena-title">
          <Guilloche variant="field" className={s.pesoField} lineWidth={0.6} duration={2000} />
          <div className={`${s.wrap} ${s.pesoGrid}`}>
            <div>
              <h2 id="quincena-title" className={s.h2}>
                {t("quincenaTitle")}
              </h2>
              <p className={s.sectionBody}>{t("quincenaBody")}</p>
            </div>
            <figure className={s.denomination} aria-label={t("denominationLabel")}>
              <span className={s.denomLabel}>{t("availableLabel")}</span>
              <span className={s.denomFigure}>
                <span className={s.denomCur}>RD$</span>12,480
              </span>
              <div className={s.timeline}>
                <div className={s.track}>
                  <span className={s.pay} style={{ left: "0%" }}>
                    {t("payday15")}
                  </span>
                  <span className={s.today} style={{ left: "20%" }}>
                    {t("today")}
                  </span>
                  {BILLS.map((b) => (
                    <span
                      key={b.day}
                      className={s.bill}
                      style={{ left: `${((b.day - 15) / 15) * 100}%` }}
                    >
                      <b>{b.day}</b>
                      <span className={s.billLabel}>{b.label}</span>
                      <em className={s.num}>{b.amount}</em>
                    </span>
                  ))}
                  <span className={s.pay} style={{ left: "100%" }}>
                    {t("payday30")}
                  </span>
                </div>
              </div>
              <figcaption className={s.sampleTagLight}>{t("sampleData")}</figcaption>
            </figure>
          </div>
        </section>

        {/* ── Cards and cuotas ──────────────────────────────────────── */}
        <section className={s.paper} aria-labelledby="cards-title">
          <div className={`${s.wrap} ${s.cardsGrid}`}>
            <div className={s.wallet} aria-hidden>
              <div className={`${s.card} ${s.cardGold}`}>
                <Guilloche className={s.cardRosette} lineWidth={0.5} />
                <span className={s.cardName}>Visa Oro</span>
                <span className={s.cardNumber}>•••• 4417</span>
                <span className={s.cardNet}>VISA</span>
              </div>
              <div className={`${s.card} ${s.cardBlack}`}>
                <Guilloche className={s.cardRosette} lineWidth={0.5} />
                <span className={s.cardName}>Mastercard Black</span>
                <span className={s.cardNumber}>•••• 0932</span>
                <span className={s.cardNet}>MASTERCARD</span>
              </div>
              <p className={s.sampleTag}>{t("cardsTyped")}</p>
            </div>

            <div>
              <h2 id="cards-title" className={s.h2}>
                {t("cardsTitle")}
              </h2>
              <p className={s.sectionBody}>{t("cardsBody")}</p>
              <ul className={s.cuotas}>
                {CUOTAS.map((c) => (
                  <li key={c.name}>
                    <div className={s.cuotaHead}>
                      <span>
                        <b>{t(c.item)}</b> · {c.name}
                      </span>
                      <span className={s.num}>{c.amount}</span>
                    </div>
                    <div
                      className={s.perf}
                      role="img"
                      aria-label={t("cuotaBadge", { n: c.n, total: c.total })}
                    >
                      {Array.from({ length: c.total }, (_, i) => (
                        <i key={i} data-paid={i < c.n ? "" : undefined} />
                      ))}
                    </div>
                    <p className={s.cuotaMeta}>
                      {t("cuotaBadge", { n: c.n, total: c.total })} ·{" "}
                      {t("cuotaLeft", { n: c.total - c.n })}
                    </p>
                  </li>
                ))}
              </ul>
              <ul className={s.facts}>
                <li>{t("factCurrencies")}</li>
                <li>{t("factTax")}</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── Close ─────────────────────────────────────────────────── */}
        <section className={s.close} aria-labelledby="close-title">
          <Guilloche className={s.closeRosette} duration={2200} />
          <Microprint text={micro} />
          <div className={s.closeInner}>
            <h2 id="close-title" className={s.closeTitle}>
              {t("closeTitle")}
            </h2>
            <p className={s.lede}>{t("closeBody")}</p>
            <Link href="/login?mode=up" className={s.cta}>
              {t("getStarted")}
              <ArrowRight aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.footerInner}>
          <span className={s.brand}>
            <Logo className="h-6 w-6" />
            <span>Cashly</span>
          </span>
          <span className={s.footerNote}>{t("footerNote")}</span>
          <nav aria-label={t("footerNav")} className={s.footerLinks}>
            <Link href="/help">{t("helpLink")}</Link>
            <Link href="/terms">{t("termsLink")}</Link>
            <Link href="/privacy">{t("privacyLink")}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
