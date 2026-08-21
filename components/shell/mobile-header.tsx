import Link from "next/link";
import { useTranslations } from "next-intl";
import { ASK_ITEM, SETTINGS_ITEM } from "@/lib/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { FigureMaskToggle } from "@/components/figure-mask/figure-mask-toggle";
import { Logo, Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function MobileHeader() {
  const t = useTranslations("Nav");
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <Logo className="h-7 w-7" />
        <Wordmark className="text-base" />
      </Link>
      {/* Every destination has a home: five tabs in the bottom bar (two of
          them behind Activity), with Ask and Settings here. No overflow menu means
          nothing can clip off the right edge.

          Theme and language stay here as well as in Settings. On a phone this
          bar is the only persistent chrome — there is no sidebar to fall back
          on — so burying a theme switch two taps deep costs more than the strip
          of width it returns. The desktop sidebar does drop them, because there
          the footer had other things competing for the same space. */}
      <div className="flex items-center gap-0.5">
        <FigureMaskToggle />
        <ThemeToggle />
        <LanguageSwitcher />
        <Button
          variant="ghost"
          size="icon"
          aria-label={t(ASK_ITEM.key)}
          nativeButton={false}
          render={<Link href={ASK_ITEM.href} />}
        >
          <ASK_ITEM.icon className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t(SETTINGS_ITEM.key)}
          nativeButton={false}
          render={<Link href={SETTINGS_ITEM.href} />}
        >
          <SETTINGS_ITEM.icon className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
