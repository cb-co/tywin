export const BILLING_CYCLE_VALUES = ["weekly", "monthly", "yearly", "custom"] as const;
export type BillingCycle = (typeof BILLING_CYCLE_VALUES)[number];

export const BILLING_CYCLES: BillingCycle[] = [...BILLING_CYCLE_VALUES];

export const CYCLE_LABEL: Record<BillingCycle, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  custom: "Custom",
};

/** Best-effort next charge date from cycle + day anchor. Display-only. */
export function nextChargeDate(
  cycle: BillingCycle,
  anchorDay: number | null,
  from = new Date(),
): Date | null {
  if (!anchorDay) return null;

  if (cycle === "weekly") {
    const targetDow = (((anchorDay - 1) % 7) + 7) % 7; // 1..7 -> 0..6
    const res = new Date(from);
    const diff = (targetDow - from.getDay() + 7) % 7 || 7;
    res.setDate(from.getDate() + diff);
    return res;
  }

  const day = Math.min(anchorDay, 28);
  let res = new Date(from.getFullYear(), from.getMonth(), day);
  if (res < from) {
    const monthsAhead = cycle === "yearly" ? 12 : 1;
    res = new Date(from.getFullYear(), from.getMonth() + monthsAhead, day);
  }
  return res;
}

/** Normalize a subscription's cost to a monthly figure for totals. */
export function monthlyEquivalent(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case "weekly":
      return (amount * 52) / 12;
    case "yearly":
      return amount / 12;
    default:
      return amount; // monthly / custom treated as monthly
  }
}
