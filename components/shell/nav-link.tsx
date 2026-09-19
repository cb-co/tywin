"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

function matches(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(href + "/");
}

export function useNavActive(href: string, match?: string[]) {
  const pathname = usePathname();
  return matches(pathname, href) || (match ?? []).some((m) => matches(pathname, m));
}

export function navItemClass(variant: "side" | "bottom", active: boolean) {
  return cn(
    "group relative flex items-center gap-3 text-sm transition-colors",
    variant === "side" && "rise px-3 py-2",
    variant === "bottom" && "min-w-0 flex-col gap-1 px-0.5 pb-1.5 pt-2 text-xs",
    // Ink density is the state: active prints in full ink and weight,
    // inactive recedes to underprint. The rule (below) is the second cue.
    active ? "font-semibold text-foreground" : "font-normal text-muted-foreground hover:text-foreground",
    variant === "side" &&
      active &&
      "before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:bg-foreground",
  );
}

/**
 * The icon + label pair. Shared so the Activity cell, which is a button rather
 * than a link, is visually identical to its neighbours.
 */
export function NavItemBody({
  variant,
  active,
  label,
  children,
}: {
  variant: "side" | "bottom";
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const bottom = variant === "bottom";
  return (
    <>
      {/* Active state is ink density, never colour alone: full ink and weight
          on the label and icon, plus a rule (a 3px bar at the sidebar's left
          edge, a top rule over the bottom band's icon). Inactive items recede
          to underprint. */}
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center transition-transform duration-150 ease-out group-active:scale-95",
          bottom && "h-7 w-12",
          bottom &&
            active &&
            "before:absolute before:-top-2 before:inset-x-3 before:h-[3px] before:bg-foreground",
        )}
      >
        <span className="relative">{children}</span>
      </span>

      <span
        className={cn(
          bottom && "w-full truncate text-center text-[10px] tracking-tight",
          // Weight doubles up on the ink density so the active tab stays
          // distinguishable without relying on hue.
          bottom && active && "font-semibold",
        )}
      >
        {label}
      </span>
    </>
  );
}

export function NavLink({
  href,
  label,
  variant,
  match,
  style,
  children,
}: {
  href: string;
  label: string;
  variant: "side" | "bottom";
  /** Extra prefixes that also count as active. */
  match?: string[];
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const active = useNavActive(href, match);
  return (
    <Link
      href={href}
      style={style}
      aria-current={active ? "page" : undefined}
      className={navItemClass(variant, active)}
    >
      <NavItemBody variant={variant} active={active} label={label}>
        {children}
      </NavItemBody>
    </Link>
  );
}
