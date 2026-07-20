import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo, Wordmark } from "@/components/brand/logo";

/** Shared shell for the standalone legal pages (Terms, Privacy). Public and
 *  unauthenticated, so it doesn't use the app shell's Sidebar/AppShell.
 *  The back link goes to "/" rather than "/login": these pages are also
 *  reachable from the public marketing home's footer, and "/" is the one
 *  destination that's correct regardless of where the visitor came from. */
export async function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("Legal");

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2.5 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <Wordmark />
        </Link>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16 pt-4">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("updated", { date: updated })}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_p+p]:mt-3">
          {children}
        </div>
      </div>
    </main>
  );
}
