import {
  Landmark,
  Wallet,
  PiggyBank,
  TrendingUp,
  Home,
  CreditCard,
  HandCoins,
  type LucideIcon,
} from "lucide-react";
export const ACCOUNT_TYPE_VALUES = [
  "checking",
  "savings",
  "cash",
  "investment",
  "asset",
  "credit_card",
  "loan",
] as const;

export type AccountType = (typeof ACCOUNT_TYPE_VALUES)[number];
export type GroupKey = "cash" | "assets" | "cards" | "loans";

type Meta = { label: string; icon: LucideIcon; group: GroupKey };

export const ACCOUNT_TYPE_META: Record<AccountType, Meta> = {
  checking: { label: "Checking", icon: Landmark, group: "cash" },
  savings: { label: "Savings", icon: PiggyBank, group: "cash" },
  cash: { label: "Cash", icon: Wallet, group: "cash" },
  investment: { label: "Investment", icon: TrendingUp, group: "cash" },
  asset: { label: "Asset", icon: Home, group: "assets" },
  credit_card: { label: "Credit card", icon: CreditCard, group: "cards" },
  loan: { label: "Loan", icon: HandCoins, group: "loans" },
};

export const CREATABLE_TYPES: AccountType[] = [...ACCOUNT_TYPE_VALUES];

/* Ordered by how often you act on a section: accounts, then the debts you
   service monthly, then property last. Assets are held for completeness of
   net worth rather than day-to-day use, and their value is a hand-maintained
   estimate rather than a balance derived from transactions, so they neither
   belong beside spendable cash nor deserve space above the fold. */
export const ACCOUNT_GROUPS: { key: GroupKey; title: string; blurb: string }[] = [
  { key: "cash", title: "Accounts", blurb: "Banks, cash, and investments." },
  { key: "cards", title: "Credit cards", blurb: "Reconciled balances and utilization." },
  { key: "loans", title: "Loans", blurb: "Outstanding balance and payoff progress." },
  { key: "assets", title: "Property & assets", blurb: "Estimated values you keep up to date." },
];

export const isCard = (t: AccountType) => t === "credit_card";
export const isLoan = (t: AccountType) => t === "loan";
export const accountTypeMeta = (t: AccountType) => ACCOUNT_TYPE_META[t];
