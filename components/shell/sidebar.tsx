import Link from "next/link";
import { useTranslations } from "next-intl";
import { NAV_ITEMS } from "@/lib/nav";
import { NavLink } from "./nav-link";
import { FigureMaskToggle } from "@/components/figure-mask/figure-mask-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
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
    <aside className="hidden md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col md:border-r md:border-sidebar-border md:bg-sidebar md:text-sidebar-foreground">
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
          decorative bubble sitting next to a link.

          The two toggles beside it are the app's only always-reachable
          controls, and they belong together: both change how the app LOOKS
          right now, both are one tap, and neither is worth a trip to Settings.
          The name yields space to them — it is already truncating, and a
          shorter name is a smaller loss than a wrapped row. Settings keeps its
          own theme row: this sidebar is desktop-only, so on mobile that row is
          the only way to reach the theme at all. */}
      <div className="flex items-center gap-1 border-t border-sidebar-border px-3 py-3">
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
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand transition-transform duration-150 group-hover:scale-105 group-active:scale-95">
              {initial}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground transition-colors group-hover:text-sidebar-accent-foreground">
            {label}
          </span>
        </Link>
        <FigureMaskToggle />
        <ThemeToggle />
      </div>
    </aside>
  );
}
