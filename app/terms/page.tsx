import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal/legal-page";

const LAST_UPDATED = "July 20, 2026";
const CONTACT_EMAIL = "info.quantcoresolutions@gmail.com";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Terms");
  return { title: t("title") };
}

export default async function TermsPage() {
  const t = await getTranslations("Terms");

  return (
    <LegalPage title={t("title")} updated={LAST_UPDATED}>
      <section>
        <h2>{t("s1Title")}</h2>
        <p>{t("s1Body")}</p>
      </section>

      <section>
        <h2>{t("s2Title")}</h2>
        <p>{t("s2Body")}</p>
      </section>

      <section>
        <h2>{t("s3Title")}</h2>
        <p>{t("s3Body")}</p>
      </section>

      <section>
        <h2>{t("s4Title")}</h2>
        <p>{t("s4Body")}</p>
      </section>

      <section>
        <h2>{t("s5Title")}</h2>
        <p>{t("s5Body")}</p>
      </section>

      <section>
        <h2>{t("s6Title")}</h2>
        <p>
          {t.rich("s6Body", {
            privacyLink: (chunks) => (
              <Link href="/privacy" className="underline underline-offset-2">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </section>

      <section>
        <h2>{t("s7Title")}</h2>
        <p>{t("s7Body")}</p>
      </section>

      <section>
        <h2>{t("s8Title")}</h2>
        <p>{t("s8Body")}</p>
      </section>

      <section>
        <h2>{t("s9Title")}</h2>
        <p>
          {t.rich("s9Body", {
            email: CONTACT_EMAIL,
            link: (chunks) => (
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
                {chunks}
              </a>
            ),
          })}
        </p>
      </section>
    </LegalPage>
  );
}
