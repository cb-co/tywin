import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { archivo } from "@/app/fonts";
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
    <main className={`${archivo.variable} flex min-h-dvh flex-col bg-background`}>
      <header className="flex h-16 shrink-0 items-center gap-2.5 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <Wordmark className="text-base" />
        </Link>
      </header>

      <div className="mx-auto w-full max-w-[70ch] flex-1 px-6 pb-16 pt-4">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>

        <h1 className="legend border-b-2 border-(--rule) pb-2 text-lg text-foreground">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("updated", { date: updated })}
        </p>

        <div className="mt-8 space-y-8 text-[0.95rem] leading-relaxed text-muted-foreground [&_h2]:legend [&_h2]:mb-2 [&_h2]:text-[11px] [&_h2]:text-foreground [&_p+p]:mt-3">
          {children}
        </div>
      </div>
    </main>
  );
}
