/**
 * A per-process cap on how often one person may ask.
 *
 * Every other LLM call in this app is triggered by writing something down — a
 * card, a subscription, a saved transaction — so the act of using the product
 * paces the spend. `/ask` has no such shape: it is a text box, and holding down
 * Enter is a perfectly ordinary thing for a person to do, let alone anyone who
 * finds the endpoint and means harm. A four-step loop that reads rows and writes
 * prose is the most expensive call in the codebase.
 *
 * Deliberately in memory, and deliberately not a database table. The whole
 * feature is read-only — that is its central promise and the thing four
 * different controls exist to enforce — and a counter table would put an INSERT
 * on the one path that must not have one. A better limiter belongs in front of
 * the app (the platform's own rate limiting) rather than inside the guarantee.
 *
 * So: best-effort, per instance. Under Fluid Compute one instance serves many
 * requests, so this catches the case it is aimed at — one person hammering one
 * box — and undercounts across a fleet. Undercounting a bill is acceptable;
 * writing to the database on this path is not.
 */

export const ASK_MAX_PER_WINDOW = 20;
export const ASK_WINDOW_MS = 5 * 60_000;

/** userId -> timestamps of accepted requests inside the window. */
const hits = new Map<string, number[]>();

/**
 * Records one request and reports whether it is allowed.
 *
 * `now` is a parameter rather than a `Date.now()` call so the window can be
 * tested without waiting five minutes for it.
 */
export function takeAskToken(userId: string, now: number): boolean {
  const cutoff = now - ASK_WINDOW_MS;
  const recent = (hits.get(userId) ?? []).filter((t) => t > cutoff);

  if (recent.length >= ASK_MAX_PER_WINDOW) {
    hits.set(userId, recent);
    return false;
  }

  recent.push(now);
  hits.set(userId, recent);

  /* Nothing else prunes this map, and an instance can outlive many sessions.
     Cheap enough to sweep whenever it grows past a size no real single instance
     reaches honestly. */
  if (hits.size > 5_000) {
    for (const [key, times] of hits) {
      if (times.every((t) => t <= cutoff)) hits.delete(key);
    }
  }

  return true;
}

/** Test seam: forget every recorded request. */
export function resetAskRateLimit(): void {
  hits.clear();
}
