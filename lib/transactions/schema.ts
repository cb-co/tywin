import { z } from "zod";

export const TRANSACTION_TYPES = ["expense", "income", "payment"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const transactionInput = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    account_id: z.string().uuid("Pick an account"),
    to_account_id: z.string().uuid().optional().or(z.literal("")),
    category_id: z.string().uuid().optional().or(z.literal("")),
    amount: z.coerce.number().positive("Enter an amount greater than zero"),
    // Payment destination leg, in the destination account's currency. Optional
    // here because only the form knows both accounts' currencies; the DB
    // rejects a cross-currency payment that omits it.
    to_amount: z.coerce.number().positive().optional(),
    currency: z.string().trim().length(3).toUpperCase(),
    exchange_rate: z.coerce.number().positive().default(1),
    include_tax: z.boolean().default(false),
    include_commission: z.boolean().default(false),
    budget_only: z.boolean().default(false),
    occurred_at: z.string().min(1, "Pick a date"),
    description: z.string().trim().max(200).optional().or(z.literal("")),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.type === "expense" && !v.category_id)
      ctx.addIssue({ code: "custom", path: ["category_id"], message: "Pick a category" });
    if (v.type === "income" && v.category_id)
      ctx.addIssue({ code: "custom", path: ["category_id"], message: "Income has no category" });
    if (v.type === "payment") {
      if (!v.to_account_id)
        ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Pick a destination account" });
      if (v.to_account_id && v.to_account_id === v.account_id)
        ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Choose a different account" });
    }
    if (v.type !== "payment" && v.to_account_id)
      ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Only payments have a destination" });
    if (v.type !== "payment" && v.to_amount !== undefined)
      ctx.addIssue({ code: "custom", path: ["to_amount"], message: "Only payments have a destination amount" });
  });

export type TransactionInput = z.infer<typeof transactionInput>;
