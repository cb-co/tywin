export type AmortizationRow = {
  n: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Standard fixed-rate monthly amortization schedule.
 * If `installment` is given it is used as the monthly payment; otherwise the
 * level payment is computed from principal, annual rate, and term. The final
 * row is trimmed so the balance lands exactly on zero.
 */
export function buildSchedule({
  principal,
  annualRate,
  termMonths,
  installment,
}: {
  principal: number;
  annualRate: number;
  termMonths: number;
  installment?: number | null;
}): AmortizationRow[] {
  if (principal <= 0 || termMonths <= 0) return [];

  const r = annualRate > 0 ? annualRate / 12 : 0;
  const computed =
    r === 0
      ? principal / termMonths
      : (principal * r) / (1 - Math.pow(1 + r, -termMonths));
  const payment = installment && installment > 0 ? installment : computed;

  const rows: AmortizationRow[] = [];
  let balance = principal;

  for (let n = 1; n <= termMonths && balance > 0.005; n++) {
    const interest = round2(balance * r);
    let principalPaid = round2(payment - interest);
    // Final scheduled month (or an overpayment) clears the remaining balance so
    // per-cent rounding never leaves a residual.
    if (principalPaid > balance || n === termMonths) principalPaid = balance;
    const rowPayment = round2(principalPaid + interest);
    balance = round2(balance - principalPaid);
    rows.push({ n, payment: rowPayment, interest, principal: principalPaid, balance });
  }

  return rows;
}
