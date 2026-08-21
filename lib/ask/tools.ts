import "server-only";
import { z } from "zod";
import { tool } from "ai";
import { createClient } from "@/lib/supabase/server";
import { guardSql } from "./guard";

/**
 * Four steps: three queries and the answer.
 *
 * One query answers most questions; the second exists so a failed one can be
 * corrected rather than surrendered; the third is slack. The fourth step is not
 * a query — it is the turn the model needs to WRITE the answer once it has the
 * rows.
 *
 * At three, a question that used all three queries ended the stream on a tool
 * result with no prose after it, and the page rendered an empty card. The step
 * budget has to be one larger than the query budget the prompt states, or the
 * last query is wasted.
 */
export const CHAT_MAX_STEPS = 4;

/**
 * How much query result may go back to the model, in bytes of JSON.
 *
 * `ask_query` caps rows, which is the wrong unit for the thing that actually
 * breaks: 500 rows of a 30-column view is well over a hundred thousand tokens.
 * That does not merely cost money, it spends the 15s budget on transferring a
 * table nobody asked for, and it pushes the schema document out of the model's
 * attention on the step where it matters most.
 *
 * Bytes, then, and generously below the model's window: an answer about money
 * is a handful of aggregate rows. Anything larger means the model should have
 * aggregated in SQL, and `truncated` is what tells it so.
 */
const MAX_RESULT_BYTES = 48_000;

/** Row counts to fall back through, largest first. */
const ROW_LADDER = [200, 100, 50, 20, 10, 5, 1];

/**
 * Trims a result to fit MAX_RESULT_BYTES, reporting that it did.
 *
 * Fails toward the smallest ladder rung rather than toward an error: one row of
 * a wide view still tells the model what shape it asked for and lets it narrow
 * the next query, where an error tells it nothing.
 */
export function capResult(data: unknown): unknown {
  if (data === null || typeof data !== "object" || !("rows" in data)) return data;

  const result = data as { rows: unknown[]; truncated?: boolean };
  const rows = Array.isArray(result.rows) ? result.rows : [];
  if (JSON.stringify(rows).length <= MAX_RESULT_BYTES) return data;

  for (const n of ROW_LADDER) {
    const kept = rows.slice(0, n);
    if (JSON.stringify(kept).length <= MAX_RESULT_BYTES) {
      return { rows: kept, truncated: true };
    }
  }

  return { rows: [], truncated: true };
}

/**
 * The model's one tool.
 *
 * `purpose` is required and is not a debug field. It is the copy the loading
 * state renders while the query runs, which is what keeps a 15s ceiling from
 * reading as a stall — and asking for it demonstrably sharpens the SQL that
 * comes with it.
 *
 * Errors are returned, never thrown. For free-form SQL that is essential
 * rather than defensive: first attempts get a column name wrong, and
 * self-correction on the next step is the difference between "I could not
 * answer that" and a right answer a second later.
 */
export function askTools() {
  return {
    askQuery: tool({
      description:
        "Run one read-only SQL SELECT against the q_ views and return the rows.",
      inputSchema: z.object({
        sql: z.string().describe("A single SELECT statement. No semicolons, no writes."),
        purpose: z
          .string()
          .describe(
            "One short line, in the user's language, saying what this query is for. Shown to them while it runs.",
          ),
      }),
      execute: async ({ sql }) => {
        const guarded = guardSql(sql);
        if (!guarded.ok) return { error: guarded.reason };

        const supabase = await createClient();
        const { data, error } = await supabase.rpc("ask_query", { p_sql: guarded.sql });

        if (error) return { error: error.message };
        return capResult(data);
      },
    }),
  };
}
