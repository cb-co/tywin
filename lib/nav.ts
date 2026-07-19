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

export const MOBILE_PRIMARY_HREFS: string[] = [
  "/",
  "/accounts",
  "/transactions",
  "/budgets",
  "/insights",
];
