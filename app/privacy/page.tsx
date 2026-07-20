import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal/legal-page";

const LAST_UPDATED = "July 20, 2026";
const CONTACT_EMAIL = "info.quantcoresolutions@gmail.com";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Privacy");
  return { title: t("title") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");

  return (
    <LegalPage title={t("title")} updated={LAST_UPDATED}>
      <section>
        <h2>{t("s1Title")}</h2>
        <p>{t("s1Body1")}</p>
        <p>{t("s1Body2")}</p>
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
        <p>{t("s6Body")}</p>
      </section>

      <section>
        <h2>{t("s7Title")}</h2>
        <p>{t("s7Body")}</p>
      </section>

      <section>
        <h2>{t("s8Title")}</h2>
        <p>
          {t.rich("s8Body", {
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
