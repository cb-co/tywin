import { NAV_ITEMS } from "@/lib/nav";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "@/components/theme-toggle";

export function Sidebar({ email }: { email: string }) {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">Finance</div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} variant="side" />
        ))}
      </nav>
      <div className="flex items-center justify-between border-t p-3">
        <span className="truncate text-xs text-muted-foreground">{email}</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
