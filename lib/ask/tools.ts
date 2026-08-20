import "server-only";
import { z } from "zod";
import { tool } from "ai";
import { createClient } from "@/lib/supabase/server";
import { guardSql } from "./guard";

/**
 * Three, against a 15s budget for the whole loop.
 *
 * One call answers most questions; the second exists so a failed query can be
 * corrected rather than surrendered; the third is slack. A fourth would mostly
 * buy the model room to wander.
 */
export const CHAT_MAX_STEPS = 3;

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
        return data;
      },
    }),
  };
}
