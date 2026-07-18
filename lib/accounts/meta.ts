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
export type GroupKey = "cash" | "cards" | "loans";

type Meta = { label: string; icon: LucideIcon; group: GroupKey };

export const ACCOUNT_TYPE_META: Record<AccountType, Meta> = {
  checking: { label: "Checking", icon: Landmark, group: "cash" },
  savings: { label: "Savings", icon: PiggyBank, group: "cash" },
  cash: { label: "Cash", icon: Wallet, group: "cash" },
  investment: { label: "Investment", icon: TrendingUp, group: "cash" },
  asset: { label: "Asset", icon: Home, group: "cash" },
  credit_card: { label: "Credit card", icon: CreditCard, group: "cards" },
  loan: { label: "Loan", icon: HandCoins, group: "loans" },
};

export const CREATABLE_TYPES: AccountType[] = [...ACCOUNT_TYPE_VALUES];

export const ACCOUNT_GROUPS: { key: GroupKey; title: string; blurb: string }[] = [
  { key: "cash", title: "Accounts & assets", blurb: "Banks, cash, investments, and assets." },
  { key: "cards", title: "Credit cards", blurb: "Reconciled balances and utilization." },
  { key: "loans", title: "Loans", blurb: "Outstanding balance and payoff progress." },
];

export const isCard = (t: AccountType) => t === "credit_card";
export const isLoan = (t: AccountType) => t === "loan";
export const accountTypeMeta = (t: AccountType) => ACCOUNT_TYPE_META[t];
