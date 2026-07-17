"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  label,
  variant,
  children,
}: {
  href: string;
  label: string;
  variant: "side" | "bottom";
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
      className={cn(
        "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
        variant === "side" && "px-3 py-2 hover:bg-accent hover:text-accent-foreground",
        variant === "bottom" && "flex-col gap-1 px-2 py-1.5 text-xs",
        active ? "text-foreground" : "text-muted-foreground",
        variant === "side" && active && "bg-accent text-accent-foreground",
      )}
    >
      {children}
      <span className={cn(variant === "bottom" && "text-[10px]")}>{label}</span>
    </Link>
  );
}
