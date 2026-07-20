import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  Repeat,
  LineChart,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; key: string; icon: LucideIcon };

/** `key` looks up a label in the `Nav` messages namespace. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", key: "overview", icon: LayoutDashboard },
  { href: "/accounts", key: "accounts", icon: Wallet },
  { href: "/transactions", key: "transactions", icon: ArrowLeftRight },
  { href: "/budgets", key: "budgets", icon: PieChart },
  { href: "/subscriptions", key: "subscriptions", icon: Repeat },
  { href: "/insights", key: "insights", icon: LineChart },
  { href: "/settings", key: "settings", icon: Settings },
];

export type MobileNavItem = NavItem & {
  /** Extra path prefixes that should also light this tab. */
  match?: string[];
  /** `sheet` opens a chooser instead of navigating. */
  kind?: "link" | "sheet";
};

/**
 * Five cells, Overview in the middle.
 *
 * Reads outward from home: what you have -> what moved -> HOME <- what you
 * planned <- what it means. Transactions and Subscriptions share the Activity
 * cell, which opens a sheet listing both — a segmented control would have
 * buried Subscriptions one level inside Transactions. Settings is in the
 * header.
 */
export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { href: "/accounts", key: "accounts", icon: Wallet },
  {
    href: "/transactions",
    key: "activity",
    icon: ArrowLeftRight,
    match: ["/subscriptions"],
    kind: "sheet",
  },
  { href: "/", key: "overview", icon: LayoutDashboard },
  { href: "/budgets", key: "budgets", icon: PieChart },
  { href: "/insights", key: "insights", icon: LineChart },
];

/** Routes offered by the Activity sheet, in display order. */
export const ACTIVITY_ITEMS: NavItem[] = ["/transactions", "/subscriptions"].map(
  (href) => NAV_ITEMS.find((i) => i.href === href)!,
);

export const SETTINGS_ITEM: NavItem = NAV_ITEMS.find(
  (i) => i.href === "/settings",
)!;
