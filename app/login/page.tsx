import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/brand/logo";
import { archivo } from "@/components/marketing/papel/fonts";
import { Guilloche } from "@/components/marketing/papel/guilloche";
import { Microprint, Serial } from "@/components/marketing/papel/microprint";
import s from "@/components/marketing/papel/papel.module.css";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error, mode } = await searchParams;
  const t = await getTranslations("Login");
  const tm = await getTranslations("Marketing");

  return (
    <main className={`${s.page} ${s.authPage} ${archivo.variable}`}>
      {/* The note panel: the same violet field the public home page leads
          with. It never inverts, so a signed-out visitor sees one brand in
          both themes. On a phone it shrinks to a band above the form. */}
      <section className={s.authNote} aria-labelledby="auth-note-title">
        <Guilloche className={s.authRosette} />
        <Microprint text={tm("microprint")} />
        <Serial value="CL 2026 000417 A" className={s.serialBottom} />
        <Link href="/" className={s.brand}>
          <Logo />
          <span>Cashly</span>
        </Link>
        <div className={s.authNoteCopy}>
          <h2 id="auth-note-title" className={s.authNoteTitle}>
            {t("heroTitle")}
          </h2>
          <p className={s.authNoteBody}>{t("heroBody")}</p>
          <p className={s.authFootnote}>{t("heroFootnote")}</p>
        </div>
      </section>

      <div className={s.authPaper}>
        <div className={s.authForm}>
          {error ? (
            <p role="alert" className={s.authError}>
              {t("linkError")}
            </p>
          ) : null}
          <LoginForm initialMode={mode === "up" ? "up" : "in"} />
        </div>
      </div>
    </main>
  );
}
