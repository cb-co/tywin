import { useTranslations } from "next-intl";
import { NAV_ITEMS } from "@/lib/nav";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo, Wordmark } from "@/components/brand/logo";

export function Sidebar({ email }: { email: string }) {
  const t = useTranslations("Nav");
  const initial = email?.trim()?.[0]?.toUpperCase() ?? "?";
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-sidebar-border md:bg-sidebar md:text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Logo />
        <Wordmark />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} href={item.href} label={t(item.key)} variant="side">
            <item.icon className="h-[18px] w-[18px] shrink-0" />
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-3 border-t border-sidebar-border px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {initial}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {email}
        </span>
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </aside>
  );
}
