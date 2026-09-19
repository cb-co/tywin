import type { CurrencyRow } from "@/lib/accounts/queries";

/** What /welcome has already saved, read fresh on every render. */
export type WelcomeData = {
  accounts: {
    id: string;
    name: string;
    type: string;
    currency: string;
    last4: string | null;
    /** Loans only. */
    installment: number | null;
    remaining: number | null;
    /** Cards only: a statement has been imported onto it. */
    imported: boolean;
  }[];
  income: { id: string; name: string; amount: number; currency: string; billing_cycle: string } | null;
  bills: { id: string; name: string; amount: number; currency: string }[];
  categories: { id: string; name: string }[];
  payCycle: string;
};

/** Props every step receives from the flow. */
export type StepProps = {
  data: WelcomeData;
  currencies: CurrencyRow[];
  baseCurrency: string;
  onNext: () => void;
  onBack?: () => void;
};

export const isMainAccount = (a: { type: string }) => a.type !== "credit_card" && a.type !== "loan";
