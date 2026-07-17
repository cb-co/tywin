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

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: PieChart },
  { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/insights", label: "Insights", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const MOBILE_PRIMARY_HREFS: string[] = [
  "/",
  "/accounts",
  "/transactions",
  "/budgets",
  "/insights",
];
