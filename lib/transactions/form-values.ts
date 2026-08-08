import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { transactionInput, type TransactionType } from "./schema";

/** The transaction dialog's own field shape: every input is a string because that
 *  is what the DOM holds, and `transactionInput` coerces on the way out. */
export type TransactionFormValues = {
  type: TransactionType;
  account_id: string;
  to_account_id: string;
  category_id: string;
  amount: string;
  /* The only rate a person is ever asked for, and only when a payment actually
     crosses currencies — becomes `to_amount`. The rate that converts a row into
     the base currency for budgets and net worth is derived server-side instead,
     since no money changed hands at that one. */
  transfer_rate: string;
  include_tax: boolean;
  include_commission: boolean;
  exclude_from_budget: boolean;
  occurred_at: string;
  description: string;
};

/** Bridges the gap between what the *control* holds and what `transactionInput`
 *  accepts. Lives here, apart from the dialog, because it has to run twice over
 *  the same submit — once in the resolver to populate `errors`, once to build the
 *  server payload — and a field that normalizes on one path but not the other
 *  fails validation with nothing on screen to explain it.
 *
 *  `category_id` holds the "none" sentinel its Select needs for "no category" —
 *  set when a payment is started fresh, or restored when editing a payment saved
 *  without one. Neither is a UUID nor "", so the schema's `.uuid().or(literal(""))`
 *  rejected it outright: switching a transaction to "payment" left category_id on
 *  "none", and submitting without ever touching that field failed with "Invalid
 *  uuid" on a field the payment form doesn't even show.
 *
 *  Income carries the same rule the schema's superRefine enforces (income has no
 *  category) — the type switch already clears it on screen, this is the same
 *  guarantee for whatever reaches the server. */
export function normalizeFormValues(values: TransactionFormValues): TransactionFormValues {
  const category_id = values.category_id === "none" ? "" : values.category_id;
  return { ...values, category_id: values.type === "income" ? "" : category_id };
}

/** The dialog's resolver. Validates `transactionInput` against the cleaned
 *  values — the only shape the schema accepts — while handing `handleSubmit`'s
 *  valid callback the form's OWN values back, sentinel intact: `onSubmit` reads
 *  `category_id === "none"` itself to decide whether a merchant rule should be
 *  offered, so a flattened copy would silently disable that check. */
export function transactionResolver(): Resolver<
  TransactionFormValues,
  unknown,
  TransactionFormValues
> {
  const validate = zodResolver(transactionInput, undefined, { raw: true });
  return (async (values: TransactionFormValues, context, options) => {
    const result = await validate(normalizeFormValues(values), context, options as never);
    if (Object.keys(result.errors).length > 0) return result;
    return { values, errors: {} };
  }) as Resolver<TransactionFormValues, unknown, TransactionFormValues>;
}
