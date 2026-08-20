/**
 * The only relations the model may read.
 *
 * This list is a correctness control before it is a security one. RLS already
 * makes every base table safe to read — what it does not do is stop the model
 * from summing `base_total_amount` off `transactions` and quietly returning a
 * number that includes transfers. The `q_` views resolve that ambiguity; the
 * whitelist is what makes reaching around them impossible rather than merely
 * discouraged.
 */
export const ALLOWED_RELATIONS = [
  "q_transactions",
  "q_accounts",
  "q_card_statements",
  "q_budgets",
] as const;

export type GuardResult = { ok: true; sql: string } | { ok: false; reason: string };

/* Whole words only, so `created_at` does not trip on `create` and `offset` does
   not trip on `set`.

   Known and accepted false positive: a legitimate `where description ilike
   '%update%'` is rejected. Merchants with a SQL keyword in the name are rare
   enough that loosening this to parse string literals would cost more safety
   than it buys usability. */
const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do|set|reset|vacuum|analyze|reindex|lock|merge|prepare|execute|listen|notify)\b/;

const FORBIDDEN_NAMESPACES = /\b(pg_[a-z_]*|information_schema|auth|storage|vault|extensions)\s*\./;

/**
 * Every function the model may call. Nothing else is callable.
 *
 * An allowlist, and the direction matters more than the contents. `stable` on
 * `ask_query` refuses a direct INSERT/UPDATE/DELETE — that much is confirmed
 * against the live database. What it does NOT refuse is a plain SELECT that
 * calls a volatile function which writes inside itself; Postgres runs that
 * happily, which was confirmed the same way, by probe rather than by argument.
 *
 * That gap has a live target. `select public.delete_own_account()` names no
 * forbidden keyword — `\bdelete\b` finds no word boundary inside
 * `delete_own_account` — and touches no relation, so every other check in this
 * file waves it through. RLS would scope the damage to the asking user, which
 * means the worst case is that someone's own account is deleted by a sentence
 * they typed.
 *
 * A denylist naming the four dangerous RPCs would be correct today and wrong
 * the first time someone adds a fifth and does not think of this file. This
 * list fails the other way: a function nobody has vetted is simply not
 * callable, and the failure mode is a rejected query rather than a deleted
 * account.
 */
const ALLOWED_FUNCTIONS = new Set([
  // Aggregates
  "sum", "count", "avg", "min", "max", "array_agg", "string_agg",
  "bool_and", "bool_or", "every", "stddev", "stddev_pop", "stddev_samp",
  "variance", "var_pop", "var_samp", "percentile_cont", "percentile_disc", "mode",
  // Window
  "row_number", "rank", "dense_rank", "percent_rank", "cume_dist", "ntile",
  "lag", "lead", "first_value", "last_value", "nth_value",
  // Math
  "abs", "ceil", "ceiling", "floor", "round", "trunc", "sign", "mod", "div",
  "power", "sqrt", "exp", "ln", "log", "greatest", "least",
  // Strings
  "length", "char_length", "character_length", "lower", "upper", "initcap",
  "trim", "btrim", "ltrim", "rtrim", "lpad", "rpad", "substring", "substr",
  "position", "strpos", "replace", "split_part", "concat", "concat_ws",
  "left", "right", "reverse", "repeat", "format", "starts_with",
  "regexp_replace", "regexp_match", "regexp_matches",
  // Dates — the ones any "last month" question needs
  "date_trunc", "date_part", "extract", "age", "now", "to_char", "to_date",
  "to_timestamp", "make_date", "make_interval", "justify_days",
  // Conditional and casting
  "coalesce", "nullif", "cast", "to_number",
]);

/**
 * Words that may sit immediately before `(` without being a function call:
 * SQL keywords, and type names carrying a precision (`numeric(12,2)`).
 *
 * Deliberately a separate set from ALLOWED_FUNCTIONS rather than one merged
 * list, so that widening what the model may *call* stays a distinct act from
 * widening the grammar it may write. Nothing in here can invoke anything.
 */
const NON_CALL_WORDS = new Set([
  // Keywords
  "and", "or", "not", "in", "exists", "all", "any", "some", "from", "join",
  "on", "where", "having", "when", "then", "else", "select", "union",
  "intersect", "except", "values", "as", "over", "filter", "using", "by",
  "group", "order", "partition", "rows", "range", "between", "is", "like",
  "ilike", "distinct", "limit", "offset", "returning", "within", "case", "end",
  // Type names that take a precision or length
  "numeric", "decimal", "varchar", "char", "character", "bit", "time",
  "timestamp", "timestamptz", "interval", "float", "int", "integer",
  "bigint", "smallint", "text", "real",
]);

/**
 * Any `schema.name(` call.
 *
 * Rejected wholesale because the allowlist above matches on the bare name, so
 * a qualified call would let the schema half go unexamined. The model has no
 * reason to qualify a function — everything it may call is in `pg_catalog`.
 */
const QUALIFIED_CALL_RE = /[a-z_][\w$]*\s*\.\s*[a-z_][\w$]*\s*\(/;

/** An identifier immediately before `(` — a function call or a keyword. */
const CALL_RE = /([a-z_][\w$]*)\s*\(/g;

/** `from`/`join` followed by a relation — `(` means a subquery, not a name. */
const RELATION_RE = /\b(?:from|join)\s+(?!\()([a-z_][\w$]*(?:\.[a-z_][\w$]*)?)/g;

/** `with x as (` and `, y as (` — CTE names are legal relations downstream. */
const CTE_RE = /(?:\bwith\b|,)\s*([a-z_][\w$]*)\s+as\s*\(/g;

/**
 * Removes `--` line comments and `/* *\/` block comments.
 *
 * Stripping rather than rejecting, because models comment their SQL and losing
 * a step of a 3-step budget to that would be absurd. Stripping is also the
 * safer of the two: it is what stops `select 1; -- \n delete ...` from
 * presenting as a single statement to a naive semicolon count.
 */
function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Decides whether one model-written string may be sent to `ask_query`.
 *
 * The app-side half of a two-layer control. The database half — `stable`, the
 * statement timeout, RLS, and the least-privilege role `ask_query` runs as —
 * is genuinely independent of this file, but it is narrower than it first
 * appears: `stable` stops DML, not a SELECT that calls something volatile. The
 * function allowlist above is what closes that, so treat it as load-bearing
 * rather than as belt-and-braces. See the spec's Execution section.
 */
export function guardSql(input: string): GuardResult {
  const sql = stripComments(input ?? "").replace(/;+\s*$/, "").trim();

  if (!sql) return { ok: false, reason: "The query was empty." };

  if (sql.includes(";")) {
    return { ok: false, reason: "Only one statement is allowed." };
  }

  if (!/^(select|with)\b/i.test(sql)) {
    return { ok: false, reason: "The query must be a SELECT." };
  }

  /* Quoted identifiers are the one shape that walks straight through the
     function allowlist below: in `"delete_own_account"()` the quote sits
     between the name and the paren, so CALL_RE never sees a call at all, and
     `public."delete_own_account"()` defeats the qualified-call check the same
     way. Found by adversarial testing after the allowlist was written and
     reviewed — which is the honest reason this check exists rather than a
     cleverer CALL_RE.

     Refusing the shape outright rather than teaching the parser about it:
     every column in the q_ views is lowercase snake_case, so nothing the model
     legitimately needs is quoted. The cost is a rejected query when a merchant
     name in a string literal contains a double quote, which is rarer than the
     bypass it closes. */
  if (sql.includes('"')) {
    return { ok: false, reason: "Double-quoted identifiers are not allowed." };
  }

  const lower = sql.toLowerCase();

  if (FORBIDDEN_KEYWORDS.test(lower)) {
    return { ok: false, reason: "That keyword is not allowed — this is read-only." };
  }

  if (FORBIDDEN_NAMESPACES.test(lower)) {
    return { ok: false, reason: "That schema is not allowed." };
  }

  if (QUALIFIED_CALL_RE.test(lower)) {
    return { ok: false, reason: "Schema-qualified function calls are not allowed." };
  }

  for (const m of lower.matchAll(CALL_RE)) {
    const name = m[1];
    if (NON_CALL_WORDS.has(name)) continue;
    if (!ALLOWED_FUNCTIONS.has(name)) {
      return { ok: false, reason: `The function "${name}" is not available.` };
    }
  }

  const ctes = new Set<string>();
  for (const m of lower.matchAll(CTE_RE)) ctes.add(m[1]);

  for (const m of lower.matchAll(RELATION_RE)) {
    const bare = m[1].replace(/^public\./, "");
    if (ctes.has(bare)) continue;
    if (!(ALLOWED_RELATIONS as readonly string[]).includes(bare)) {
      return {
        ok: false,
        reason: `"${bare}" is not available. Query only: ${ALLOWED_RELATIONS.join(", ")}.`,
      };
    }
  }

  return { ok: true, sql };
}
