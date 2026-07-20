/**
 * Money helpers shared by the transaction form and its schema.
 *
 * A payment moves value between two accounts that may not share a currency, so
 * it carries two amounts: `amount` in the source account's currency and
 * `to_amount` in the destination's. Everything here produces the second from
 * the first — the DB stores both and never re-derives one from the other.
 */

/** Round to the 4 decimals `numeric(18,4)` keeps, so TS and Postgres agree. */
export function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function assertPositive(rate: number): void {
  if (!(rate > 0) || !Number.isFinite(rate)) {
    throw new Error(`Exchange rate must be a positive number, got ${rate}`);
  }
}

/**
 * Flip a rate between the two directions.
 *
 * The DB stores `exchange_rate` as base-currency units per 1 unit of the
 * transaction's currency (0.1742 USD per DOP). The form shows the reciprocal —
 * "1 USD = 5.741 DOP" — because the base currency is usually the stronger one
 * and that keeps the number a person types whole-ish.
 */
export function invertRate(rate: number): number {
  assertPositive(rate);
  return 1 / rate;
}

/**
 * The destination leg of a payment.
 *
 * `rate` is units of the destination currency per 1 unit of the source's, the
 * same direction the form displays.
 */
export function destinationAmount(amount: number, rate: number): number {
  assertPositive(rate);
  return round4(amount * rate);
}
