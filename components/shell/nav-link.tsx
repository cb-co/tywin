"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  label,
  variant,
  style,
  children,
}: {
  href: string;
  label: string;
  variant: "side" | "bottom";
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      style={style}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
        variant === "side" &&
          "rise px-3 py-2 hover:bg-accent hover:text-accent-foreground",
        variant === "bottom" && "flex-col gap-1 px-2 py-1.5 text-xs",
        active ? "text-foreground" : "text-muted-foreground",
        variant === "side" && active && "bg-accent text-accent-foreground",
      )}
    >
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
          fight the sidebar's alignment. */}
      <span className="shrink-0 transition-transform duration-150 ease-out group-hover:scale-110 group-active:scale-95">
        {children}
      </span>

      <span className={cn(variant === "bottom" && "text-[10px]")}>{label}</span>
    </Link>
  );
}
