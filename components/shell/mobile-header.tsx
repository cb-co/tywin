import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { NAV_ITEMS, MOBILE_PRIMARY_HREFS } from "@/lib/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OVERFLOW_ITEMS = NAV_ITEMS.filter(
  (i) => !MOBILE_PRIMARY_HREFS.includes(i.href),
);

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur md:hidden">
      <span className="font-semibold">Finance</span>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" aria-label="More navigation" />}
          >
            <MoreHorizontal className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {OVERFLOW_ITEMS.map((item) => (
              <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
