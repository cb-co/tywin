import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The prose half of the model's schema knowledge, kept beside the migration
 * that defines the views so the two move together.
 *
 * Read from disk rather than imported as a string so that correcting a wrong
 * answer is a text edit, not a code change. Cached after the first read — the
 * file cannot change under a running process.
 */
let cached: string | null = null;

export function schemaDoc(): string {
  cached ??= readFileSync(join(process.cwd(), "lib/ask/schema-doc.md"), "utf8");
  return cached;
}

/**
 * Every column name the document claims exists, per view.
 *
 * Parsed out of the markdown rather than maintained separately, because a
 * second list would drift from the first exactly as fast as the first drifts
 * from the database. Backticked identifiers under each `## view` heading.
 */
export function documentedColumns(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const sections = schemaDoc().split(/^## /m).slice(1);

  for (const section of sections) {
    const view = section.split(/\s/)[0].trim();
    if (!view.startsWith("q_")) continue;
    const names = [...section.matchAll(/`([a-z_][a-z0-9_]*)`/g)].map((m) => m[1]);
    out.set(view, [...new Set(names)]);
  }

  return out;
}
