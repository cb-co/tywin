"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav";

export function NavLink({ item, variant }: { item: NavItem; variant: "side" | "bottom" }) {
  const pathname = usePathname();
  const active =
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
        variant === "side" && "px-3 py-2 hover:bg-accent hover:text-accent-foreground",
        variant === "bottom" && "flex-col gap-1 px-2 py-1.5 text-xs",
        active ? "text-foreground" : "text-muted-foreground",
        variant === "side" && active && "bg-accent text-accent-foreground",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className={cn(variant === "bottom" && "text-[10px]")}>{item.label}</span>
    </Link>
  );
}
