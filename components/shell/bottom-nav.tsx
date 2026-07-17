import { NAV_ITEMS } from "@/lib/nav";
import { NavLink } from "./nav-link";

// Show the 5 most-used destinations on the mobile bottom bar.
const MOBILE_ITEMS = NAV_ITEMS.filter((i) =>
  ["/", "/accounts", "/transactions", "/budgets", "/insights"].includes(i.href),
);

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t bg-card/95 backdrop-blur md:hidden">
      {MOBILE_ITEMS.map((item) => (
        <NavLink key={item.href} item={item} variant="bottom" />
      ))}
    </nav>
  );
}
