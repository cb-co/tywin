import Link from "next/link";
import { useTranslations } from "next-intl";
import { NAV_ITEMS } from "@/lib/nav";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo, Wordmark } from "@/components/brand/logo";
import { profileLabel, profileInitial } from "@/lib/profile";

export function Sidebar({
  email,
  displayName,
  avatarUrl,
}: {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}) {
  const t = useTranslations("Nav");
  const label = profileLabel(displayName, email);
  const initial = profileInitial(displayName, email);

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-sidebar-border md:bg-sidebar md:text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Logo />
        <Wordmark />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
        {NAV_ITEMS.map((item, i) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={t(item.key)}
            variant="side"
            style={{ "--i": i } as React.CSSProperties}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
          </NavLink>
        ))}
      </nav>

      {/* Account row. The whole block is one target into Settings, so the
          avatar and the name read as a single affordance rather than a
          decorative bubble sitting next to a link. */}
      <div className="flex items-center gap-2 border-t border-sidebar-border px-3 py-3">
        <Link
          href="/settings"
          title={email}
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-md px-1.5 py-1.5 transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Google avatar host isn't registered for next/image optimization.
            <img
              src={avatarUrl}
              alt={label}
              referrerPolicy="no-referrer"
              className="h-8 w-8 shrink-0 rounded-full object-cover transition-transform duration-150 group-hover:scale-105 group-active:scale-95"
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary transition-transform duration-150 group-hover:scale-105 group-active:scale-95">
              {initial}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground transition-colors group-hover:text-sidebar-accent-foreground">
            {label}
          </span>
        </Link>
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </aside>
  );
}
