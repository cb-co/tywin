import { z } from "zod";
import { ACCOUNT_TYPE_VALUES } from "./meta";

export const accountInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    type: z.enum(ACCOUNT_TYPE_VALUES),
    currency: z.string().trim().length(3, "Use a 3-letter code").toUpperCase(),
    starting_balance: z.coerce.number().finite().default(0),
    color: z.string().trim().max(9).optional().or(z.literal("")),
    bank_id: z.string().uuid().optional().or(z.literal("")),

    // Fee settings (all types)
    transfer_tax_rate: z.coerce.number().min(0).max(1).default(0.002),
    network_fee_amount: z.coerce.number().min(0).default(0),
    network_fee_optional: z.boolean().default(true),

    // Credit-card fields
    credit_limit: z.coerce.number().min(0).optional(),
    statement_closing_day: z.coerce.number().int().min(1).max(31).optional(),
    payment_due_day: z.coerce.number().int().min(1).max(31).optional(),
    current_balance: z.coerce.number().min(0).default(0),
    card_group_id: z.string().uuid().optional().or(z.literal("")),

    // Loan fields
    principal: z.coerce.number().min(0).optional(),
    interest_rate: z.coerce.number().min(0).max(1).optional(),
    term_months: z.coerce.number().int().min(1).max(1200).optional(),
    original_term_months: z.coerce.number().int().min(1).max(1200).optional(),
    start_date: z.string().optional().or(z.literal("")),
    installment_amount: z.coerce.number().min(0).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "credit_card") {
      for (const f of ["credit_limit", "statement_closing_day", "payment_due_day"] as const) {
        if (v[f] === undefined)
          ctx.addIssue({ code: "custom", path: [f], message: "Required for credit cards" });
      }
    }
    if (v.type === "loan") {
      for (const f of ["principal", "term_months", "installment_amount"] as const) {
        if (v[f] === undefined)
          ctx.addIssue({ code: "custom", path: [f], message: "Required for loans" });
      }
      if (v.original_term_months !== undefined && v.term_months !== undefined && v.original_term_months < v.term_months)
        ctx.addIssue({
          code: "custom",
          path: ["original_term_months"],
          message: "Can't be less than the remaining term",
        });
    }
  });

export type AccountInput = z.infer<typeof accountInput>;

export const cardStatementInput = z.object({
  account_id: z.string().uuid(),
  period_start: z.string().min(1, "Required"),
  period_end: z.string().min(1, "Required"),
  statement_balance: z.coerce.number().default(0),
  total_balance: z.coerce.number().default(0),
  total_debits: z.coerce.number().min(0).default(0),
  total_credits: z.coerce.number().min(0).default(0),
  due_date: z.string().optional().or(z.literal("")),
});

export type CardStatementInput = z.infer<typeof cardStatementInput>;
