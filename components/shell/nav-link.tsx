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
    variant === "side" &&
      "rise px-3 py-2 hover:bg-accent hover:text-accent-foreground",
    variant === "bottom" && "min-w-0 flex-col gap-1 px-0.5 pb-1.5 pt-1 text-xs",
    active ? "text-foreground" : "text-muted-foreground",
    variant === "side" && active && "bg-accent text-accent-foreground",
    // The bottom bar has no persistent rail, so the active tab takes the
    // brand green outright.
    variant === "bottom" && active && "text-primary",
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
      {/* Active rail. Grows from the vertical centre so switching routes
          reads as the marker moving, not two separate elements blinking. */}
      {variant === "side" ? (
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-transform duration-200 ease-out",
            active ? "scale-y-100" : "scale-y-0",
          )}
        />
      ) : null}

      {/* The icon carries the hover feedback: nudging the whole row would
          fight the sidebar's alignment. In the bottom bar it also sits in a
          pill that fills with primary when active — colour alone is too weak
          a signal at 20px, and it must not be the only signal for anyone who
          can't separate green from grey. */}
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center transition-transform duration-150 ease-out group-hover:scale-110 group-active:scale-95",
          bottom && "h-7 w-12",
        )}
      >
        {bottom ? (
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full bg-primary/15 transition-all duration-200 ease-out",
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
