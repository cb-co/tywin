import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";
import { Logo, Wordmark } from "@/components/brand/logo";
import { SpotIllustration } from "@/components/brand/spot-illustration";

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
      {/* The signature gradient, the same slab the overview hero uses — it is
          the one surface that does not invert, so the first thing a signed-out
          visitor sees is identical in both themes. This previously reached for
          background and text utilities built on the removed brand panel tokens;
          Tailwind emits nothing for an unknown utility rather
          than failing, so the panel had silently been rendering with no
          background at all while the build stayed green. Class names are spelt
          out in prose here on purpose — the content scanner matches class-like
          tokens inside comments too, and naming a dead one would resurrect it
          in the stylesheet. */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[image:var(--hero)] p-10 text-(--hero-foreground) lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo />
          <Wordmark />
        </div>
        <div className="relative z-10 max-w-md space-y-4">
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight">
            {t("heroTitle")}
          </h2>
          <p className="opacity-75">{t("heroBody")}</p>
        </div>
        <p className="relative z-10 text-xs opacity-60">{t("heroFootnote")}</p>
        {/* Replaces the two outline rings that used to sit here. Painted in the
            inherited hero foreground rather than `--brand`, which on this
            gradient would be violet on violet. */}
        <SpotIllustration
          scene="wallet"
          className="pointer-events-none absolute -bottom-8 -right-8 size-80 text-current opacity-40"
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
