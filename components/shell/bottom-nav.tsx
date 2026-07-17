import { NAV_ITEMS, MOBILE_PRIMARY_HREFS } from "@/lib/nav";
import { NavLink } from "./nav-link";

const MOBILE_ITEMS = NAV_ITEMS.filter((i) => MOBILE_PRIMARY_HREFS.includes(i.href));

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t bg-card/95 backdrop-blur md:hidden">
      {MOBILE_ITEMS.map((item) => (
        <NavLink key={item.href} item={item} variant="bottom" />
      ))}
    </nav>
  );
}
