import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  Repeat,
  LineChart,
  MessagesSquare,
  Settings,
  CircleHelp,
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
  { href: "/ask", key: "ask", icon: MessagesSquare },
  { href: "/settings", key: "settings", icon: Settings },
  { href: "/help", key: "help", icon: CircleHelp },
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

/**
 * Ask Cashly, for the mobile header.
 *
 * The bottom bar is a deliberate five-cell layout (see above) and Ask does not
 * displace anything in it: a sixth cell takes every other tab from 66px to 55px
 * at 360px, and the Spanish budgets label already truncates at five. The primary
 * mobile entry is the box on Overview; this is the one that works from any other
 * screen, beside Settings because that strip is the only persistent chrome a
 * phone gets.
 *
 * `MessagesSquare`: the one square in a rail of circles and charts, and the only
 * shape here that means conversation. It has to dodge two marks, not one — a
 * question mark in a circle collides with Help two rows below (the confusion the
 * label "Ask Cashly" also exists to settle), and Sparkles collides with the
 * recommendation card, which had it first and is the surface people already read
 * as the app noticing something. Sharing that mark sounded like family and
 * looked, stacked on Overview, like the same chip printed twice.
 *
 * A speech bubble is also the more honest mark: this is a conversation you start,
 * not a thing that happens to you.
 */
export const ASK_ITEM: NavItem = NAV_ITEMS.find((i) => i.href === "/ask")!;
