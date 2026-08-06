import type { AccountType } from "./meta";

/** The account dialog's own field shape: every input is a string because that is
 *  what the DOM holds, and `accountInput` coerces on the way out. */
export type AccountFormValues = {
  name: string;
  type: AccountType;
  currency: string;
  bank_id: string;
  starting_balance: string;
  transfer_tax_rate: string;
  network_fee_amount: string;
  network_fee_optional: boolean;
  credit_limit: string;
  last4: string;
  statement_closing_day: string;
  payment_due_day: string;
  current_balance: string;
  card_group_id: string;
  welcome_bonus_goal_amount: string;
  welcome_bonus_goal_currency: string;
  welcome_bonus_due_date: string;
  has_welcome_bonus_goal: boolean;
  principal: string;
  interest_rate: string;
  term_months: string;
  original_term_months: string;
  start_date: string;
  installment_amount: string;
};

/** Every "" becomes undefined — mirrors what `accountInput`'s superRefine checks for
 *  conditionally-required numeric fields. */
export function blankToUndefined<T extends Record<string, unknown>>(values: T): T {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v === "" ? undefined : v]),
  ) as T;
}

/** Bridges the gap between what the *controls* hold and what `accountInput` accepts.
 *  Lives here, apart from the dialog, because it has to run twice over the same submit —
 *  once in the resolver to populate `errors`, once to build the server payload — and every
 *  bug this form has had was those two paths disagreeing. A field that normalizes on one
 *  path but not the other fails validation with nothing on screen to explain it, since
 *  none of the fields below render a FieldError.
 *
 *  Two mismatches to close:
 *  - `bank_id`/`card_group_id` hold the "none"/"new" sentinels their Selects need. Neither
 *    is a UUID nor "", so the schema's `.uuid().or(literal(""))` rejects both.
 *  - The welcome-bonus fields keep whatever was typed into them after the toggle goes back
 *    off, and the schema's bonus rule is all-or-nothing: a leftover value in any one of the
 *    three demands the other two, reported onto fields the closed toggle no longer renders.
 *    Clearing the trio here matches what the payload has always sent. (The trio now also
 *    starts empty — the goal currency has no default — so a card whose toggle was never
 *    touched is already consistent; this covers the toggle-on-then-off path.) */
export function normalizeFormValues(values: AccountFormValues): AccountFormValues {
  const sentinel = (v: string) => (v === "none" || v === "new" ? "" : v);
  return {
    ...values,
    bank_id: sentinel(values.bank_id),
    card_group_id: sentinel(values.card_group_id),
    ...(values.has_welcome_bonus_goal
      ? null
      : {
          welcome_bonus_goal_amount: "",
          welcome_bonus_goal_currency: "",
          welcome_bonus_due_date: "",
        }),
  };
}
