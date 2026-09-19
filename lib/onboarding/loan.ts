import type { AccountInput } from "@/lib/accounts/schema";

/** What onboarding's short loan form collects, as typed. */
export type OnboardingLoan = {
  name: string;
  currency: string;
  owedToday: string;
  installment: string;
  remainingInstallments: string;
  dueDay: string;
  /** Optional; a percent as typed ("18.5"), not the stored fraction. */
  annualRatePercent: string;
};

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

/**
 * Describes a loan as it stands today rather than as it was originated.
 *
 * `loan_status` amortizes from `principal` using only the payments recorded
 * against the account, with `term_months` as the count that clears it. So what
 * is owed today, the installments left and a start date of today give the same
 * outstanding balance as the full history would — without asking a new user
 * for figures from years ago. The result is still validated by `accountInput`
 * on the server; blanks stay undefined so a missing field fails there.
 */
export function loanAccountFromOnboarding(loan: OnboardingLoan, today: string): AccountInput {
  const rate = num(loan.annualRatePercent);
  return {
    name: loan.name.trim(),
    type: "loan",
    currency: loan.currency,
    starting_balance: 0,
    transfer_tax_rate: 0.002,
    network_fee_amount: 0,
    network_fee_optional: true,
    current_balance: 0,
    principal: num(loan.owedToday),
    installment_amount: num(loan.installment),
    term_months: num(loan.remainingInstallments),
    payment_due_day: num(loan.dueDay),
    interest_rate: rate === undefined ? undefined : rate / 100,
    start_date: today,
  };
}
