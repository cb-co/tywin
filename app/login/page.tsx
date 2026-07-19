import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";
import { Logo, Wordmark } from "@/components/brand/logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { error } = await searchParams;
  const t = await getTranslations("Login");

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo variant="ghost" />
          <span className="text-lg font-semibold tracking-tight">Cashly</span>
        </div>
        <div className="relative z-10 max-w-md space-y-4">
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight">
            {t("heroTitle")}
          </h2>
          <p className="text-primary-foreground/75">{t("heroBody")}</p>
        </div>
        <p className="relative z-10 text-xs text-primary-foreground/60">
          {t("heroFootnote")}
        </p>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full border border-primary-foreground/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 bottom-20 h-64 w-64 rounded-full border border-primary-foreground/10"
        />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center gap-2.5 lg:hidden">
            <Logo />
            <Wordmark />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-3xl font-semibold tracking-tight">
              {t("welcomeBack")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("welcomeBody")}</p>
          </div>
          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {t("linkError")}
            </p>
          ) : null}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
