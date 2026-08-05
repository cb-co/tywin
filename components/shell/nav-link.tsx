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
    "group relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
    variant === "side" && "rise px-3 py-2",
    // Hover is gated to the inactive state: the active row is now a filled
    // sidebar-primary pill, and an unconditional hover:bg-accent would sit at
    // the same specificity and win on :hover, flashing the fill back to the
    // pale accent tint every time the pointer crosses an active item.
    variant === "side" &&
      !active &&
      "hover:bg-accent hover:text-accent-foreground",
    variant === "bottom" && "min-w-0 flex-col gap-1 px-0.5 pb-1.5 pt-1 text-xs",
    active ? "text-foreground" : "text-muted-foreground",
    variant === "side" &&
      active &&
      "rounded-full bg-sidebar-primary text-sidebar-primary-foreground",
    // The bottom bar signals active state through its icon pill (below) and
    // label weight instead; the row itself just tints to the brand ink so
    // the label reads as active without ever sitting on a coloured fill.
    variant === "bottom" && active && "text-brand",
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
      {/* The sidebar no longer needs a separate rail marker: the active row
          is a solid sidebar-primary pill (see navItemClass), which is an
          unambiguous signal on its own — a rail in the same brand hue would
          just sit invisibly on top of the fill it's drawn over. */}

      {/* The icon carries the hover feedback: nudging the whole row would
          fight the sidebar's alignment. In the bottom bar it also sits in a
          pill that fills solid with sidebar-primary when active, so the icon
          itself flips to sidebar-primary-foreground to stay legible on the
          fill. Ink-on-ivory is a weak signal at 20px, and with the palette
          now near-neutral it must not be the only signal at all — the pill
          and the label weight carry it. */}
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center transition-transform duration-150 ease-out group-hover:scale-110 group-active:scale-95",
          bottom && "h-7 w-12",
          bottom && active && "text-sidebar-primary-foreground",
        )}
      >
        {bottom ? (
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full bg-sidebar-primary transition-all duration-200 ease-out",
              active ? "scale-100 opacity-100" : "scale-75 opacity-0",
            )}
          />
        ) : null}
        <span className="relative">{children}</span>
      </span>

      <span
        className={cn(
          bottom && "w-full truncate text-center text-[10px] tracking-tight",
          // Weight doubles up on the colour so the active tab stays
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
