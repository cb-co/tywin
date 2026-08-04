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
    // Four digits or nothing. The pattern is checked here on purpose: the
    // `color` field above is `max(9)` with no pattern, which is exactly how a
    // malformed hex reached the card face, and the database's own check
    // constraint is a backstop that surfaces as an opaque error rather than a
    // usable message.
    last4: z
      .string()
      .trim()
      .regex(/^[0-9]{4}$/, "Enter exactly four digits")
      .optional()
      .or(z.literal("")),
    welcome_bonus_goal_amount: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.coerce.number().min(0).optional(),
    ),
    welcome_bonus_goal_currency: z.string().trim().length(3, "Use a 3-letter code").toUpperCase().optional().or(z.literal("")),
    welcome_bonus_due_date: z.string().optional().or(z.literal("")),

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
      const bonusFields = [
        v.welcome_bonus_goal_amount,
        v.welcome_bonus_goal_currency,
        v.welcome_bonus_due_date,
      ];
      const anySet = bonusFields.some((f) => f !== undefined && f !== "");
      const allSet = bonusFields.every((f) => f !== undefined && f !== "");
      if (anySet && !allSet) {
        ctx.addIssue({
          code: "custom",
          path: ["welcome_bonus_goal_amount"],
          message: "Set the goal amount, currency, and due date together, or leave all blank",
        });
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
