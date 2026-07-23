import { z } from "zod";

export const LineSchema = z.object({
  madeOn: z.string(),
  postedOn: z.string(),
  reference: z.string().nullable(),
  description: z.string(),
  mcc: z.string().nullable(),
  authCode: z.string().nullable(),
  amount: z.string(),
  kind: z.enum(["purchase", "fee", "credit", "payment"]),
  suggestedCategory: z.string().nullable(),
});

export const SectionSchema = z.object({
  sectionKey: z.string(),
  currency: z.string(),
  periodEnd: z.string(),
  dueDate: z.string().nullable(),
  previousBalance: z.string(),
  closingBalance: z.string(),
  balanceToPay: z.string().nullable(),
  minimumPayment: z.string().nullable(),
  overdueAmount: z.string().nullable(),
  overdueInstallments: z.number().nullable(),
  creditLimit: z.string().nullable(),
  availableCredit: z.string().nullable(),
  interestRateAnnual: z.number().nullable(),
  avgDailyBalance: z.string().nullable(),
  avgDailyBalancePrior: z.string().nullable(),
  costOfCarry: z.string().nullable(),
  costOfCarryPrior: z.string().nullable(),
  totalDebits: z.string().nullable(),
  totalCredits: z.string().nullable(),
  lines: z.array(LineSchema),
});

export const StatementSchema = z.object({
  cardNetwork: z.enum(["visa", "mastercard", "amex", "discover", "other"]),
  cardLast4: z.string().nullable(),
  sections: z.array(SectionSchema),
});

export type LlmLine = z.infer<typeof LineSchema>;
export type LlmSection = z.infer<typeof SectionSchema>;
export type LlmStatement = z.infer<typeof StatementSchema>;
