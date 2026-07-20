import { useTranslations } from "next-intl";
import { MOBILE_NAV_ITEMS } from "@/lib/nav";
import { NavLink } from "./nav-link";
import { ActivitySheet } from "./activity-sheet";

export function BottomNav() {
  const t = useTranslations("Nav");
  return (
    // Equal columns rather than `justify-around`: even spacing stops the
    // longest label (es "Transacciones") from stealing width from its
    // neighbours and pushing the row out of alignment.
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid items-center border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      style={{
        gridTemplateColumns: `repeat(${MOBILE_NAV_ITEMS.length}, minmax(0, 1fr))`,
      }}
    >
      {MOBILE_NAV_ITEMS.map((item) =>
        item.kind === "sheet" ? (
          // No props: `item` holds an icon component, which cannot cross the
          // server/client boundary. ActivitySheet reads the config itself.
          <ActivitySheet key={item.href} />
        ) : (
          <NavLink
            key={item.href}
            href={item.href}
            label={t(item.key)}
            variant="bottom"
            match={item.match}
          >
            <item.icon className="h-5 w-5 shrink-0" />
          </NavLink>
        ),
      )}
    </nav>
  );
}
