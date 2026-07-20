import Link from "next/link";
import { useTranslations } from "next-intl";
import { SETTINGS_ITEM } from "@/lib/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
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
          them behind Activity) and Settings here. No overflow menu means
          nothing can clip off the right edge. */}
      <div className="flex items-center gap-0.5">
        <ThemeToggle />
        <LanguageSwitcher />
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
