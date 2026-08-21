# Conversational queries over your own data

## Context

Every number in the app today lives on a screen someone designed in advance.
The overview knows net worth, Insights knows the donut, Budgets knows the bars.
Anything nobody anticipated — "how much did I spend on transportation last
month", "what went on the Amex Platinum between the 8th and the 14th" — has no
answer, because there is no screen for it.

This adds one: a text box that takes a question in English or Spanish, lets
Gemini write SQL against the user's own data, and answers in prose with the
real figures in it.

Free-form, deliberately. The model composes whatever query the question needs —
joins, date arithmetic, grouping it invents on the spot. The guardrails are on
*what it may touch* and *what it may not do*, never on the shape of the
question.

## What this is not

- **Not writes.** It cannot log a transaction, recategorise anything, or edit a
  budget. Read the Execution section before trusting that sentence: the
  no-writes property rests mainly on one app-side parser, `stable` covers less
  than this document originally claimed, and the privilege-level backstop was
  attempted and abandoned for reasons recorded there.
- **Not an MCP server.** MCP is a transport between a host AI client and a tool
  server. This chat lives inside the app, so the tool goes straight to
  `streamText` and the protocol layer buys nothing.
- **Not a general SQL console.** The model queries four purpose-built views and
  nothing else. It cannot reach the base tables.
- **Not stored history.** One transcript, in memory, gone on reload. If chats
  should be persisted, that is a later decision with nothing to migrate.
- **Not advice.** Same house rule as `lib/overview/recommendation/llm.ts`: no
  investment, tax, or product recommendations.

## The problem the view layer solves

The schema encodes storage, not meaning, and the gap between the two is where
this feature would quietly fail.

`transactions` carries `amount`, `total_amount`, `base_amount`, and
`base_total_amount`, differing by fees, tax, and FX. `type` is
`expense | income | payment`, so transfers between a person's own accounts sit
in the same table as real spending. Which column is *correct* depends on the
question — and the codebase already contains two different right answers:

```sql
-- spend_distribution / category_usage — what the budget screens count
type in ('expense','payment') and not exclude_from_budget
  → sum(base_total_amount)

-- monthly_cashflow — what actually left an account
expense on a NON-liability account, OR payment INTO a card/loan
-- a credit-card expense is borrowed, so it is not cash out yet
```

A model handed the column list will write syntactically perfect SQL and return
a confidently wrong number. That is the worst available failure mode, because
nothing looks broken and the user stops checking.

So the model never sees the base tables. It sees four views where each
ambiguity is already resolved, and both spend rules arrive precomputed as
columns it only has to sum.

## The view layer

Four views, all `with (security_invoker = true)` — the pattern
`monthly_cashflow` already uses — so RLS scopes every row to the caller.

The `q_` prefix is load-bearing, not cosmetic: the executor whitelists
relations by it, which is what makes "the model cannot reach `transactions`" a
mechanical fact rather than a hope.

### `q_transactions`

One row per transaction, everything joined in.

```
id, occurred_at, type, description, notes
account_id, account, account_type, account_brand, account_last4, bank
to_account_id, to_account, to_account_type          -- transfer destination
category_id, category, subscription_id, subscription
currency, amount, total_amount                       -- as charged
base_currency, base_amount, base_total_amount        -- converted
budget_spend, cash_out, cash_in                      -- the two rules, precomputed
exclude_from_budget, fx_fallback, mcc
```

`budget_spend` is `base_total_amount` where the budget rule includes the row
and `0` otherwise; `cash_out` is `base_total_amount` where the cashflow rule
includes it and `0` otherwise; `cash_in` is income. `SUM()` over any of the
three is then correct by construction, and picking the wrong one is a mistake
the model cannot make silently — the column names say what they mean.

`mcc` rides along from `card_statement_lines` via `statement_line_id`: free
merchant-category signal on anything that arrived by statement import.

### `q_accounts`

One row per account, with live status folded in so account questions answer
without a second hop.

Identity: `id, name, type, brand, last4, bank, card_group, currency,
is_archived`. Balance from `account_balances`. The card block from
`card_status`: `credit_limit, owed, utilization_pct, latest_statement_balance,
latest_due_date, latest_period_end, statement_closing_day, payment_due_day,
interest_rate`. The loan block from `loan_status`: `outstanding_balance,
installment_amount, installments_paid, term_months, original_term_months,
principal, start_date`.

This is what makes *"my Amex Platinum"* resolvable. The model matches on name,
brand, or last4, gets an `account_id`, and filters `q_transactions` by it. It
is also what lets the feature answer about accounts directly — utilisation,
what is due when, how much is left on a loan.

### `q_card_statements`

One row per statement period: `account_id, account, period_start, period_end,
due_date, statement_balance, minimum_payment, previous_balance, total_debits,
total_credits, cashback_total, interest_rate_annual, avg_daily_balance,
cost_of_carry, credit_limit, available_credit, overdue_amount`.

Statement-level facts are read, not re-derived from lines.

### `q_budgets`

Month × category with `month, category_id, category, budget, used, remaining,
status` — `category_usage` generalised off its `p_month`-only signature.

### Deliberately absent from v1

Savings goals, subscriptions as their own view (the name rides along on
`q_transactions`), and raw statement lines. Each is a one-view addition once we
see what the thing actually cannot answer. Guessing now is how a semantic layer
becomes six views nobody queries.

### Known narrowness in the shipped views

Recorded rather than fixed. None of these produces a wrong answer — each is a
question the feature answers less well than it could — and every one costs a DDL
push against the live project, so they wait for evidence that anyone asks.

- **`q_budgets` is narrower than `category_usage`.** The screen starts from
  `categories` and returns every category with a `status` enum; the view starts
  from `category_budgets`, so a category with no budget set has no row and there
  is no `status`. The document says so, and per-category spend without a budget
  is a `q_transactions` question anyway. `status` is derivable from `budget` and
  `used`.
- **`q_budgets` re-derives the budget rule** in its lateral join instead of
  summing `budget_spend` off `q_transactions`. That is a third copy of the one
  rule this whole design exists to keep in one place, and it will drift. The fix
  is mechanical; it needs a migration.
- **`q_card_statements` omits `section_key` and `total_balance`.** One row per
  period per card holds today because the importer refuses two sections against
  one account, and `statement_balance` is the figure a person means. A cuotas
  question wants `total_balance`.

## Execution

One function. `security invoker`, `set search_path = ''`, and — critically —
`stable`.

```sql
create or replace function public.ask_query(p_sql text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$ ... $$;
```

Four layers. They are not equal, and the ordering below is by execution, not
by strength — layer 1 carries far more weight than the original draft assumed.

**1. TypeScript pre-flight** (`lib/ask/guard.ts`), before the string leaves
Node: one statement only, must open with `select` or `with`, whole-word
denylist (`insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|
call|do|set|vacuum`), no `pg_*` / `information_schema` / `auth.` / `storage.`,
every relation named after `from` or `join` must be in the `q_` whitelist, and
every identifier followed by `(` must be in an allowlist of ordinary SQL
functions.

The relation clause does double duty. It is a security control, but mostly it
is the thing that stops the model quietly falling back to `transactions` and
summing the wrong column. The function clause is purely a security control, and
layer 2 explains why it exists.

Three shapes are refused outright rather than parsed: double-quoted identifiers
(`"delete_own_account"()` hides a call from the allowlist, since the quote sits
between the name and the paren), dollar quoting, and `E'...'` literals (the one
dialect where a backslash can hide a closing quote from the literal scanner).
Nothing a money question needs is written any of those ways.

Layer 1 also **rewrites** rather than only judging. Every whitelisted view is
schema-qualified to `public.q_*` on the way out, outside string literals, and
the statement that goes to the database is the rewritten one. Without that step
nothing works at all: the executor sets `search_path = ''`, so the model's
natural `from q_transactions` — which is what the schema document teaches —
resolves to nothing and every question in the product dies on `relation
"q_transactions" does not exist`.

The useful consequence is that the empty search_path becomes a control in its
own right. A relation the rewrite does not recognise stays bare and resolves to
nothing, so a base table that slips past the relation check — the second item of
a comma join, `from q_transactions t, accounts a`, which is only ever inspected
after `from` and `join` — is refused by the engine instead of read and quietly
summed. The regex missing something now costs a rejected query rather than a
wrong number.

**2. `stable` on the function — a real guard, and narrower than it looks.**

This section originally read: "Postgres refuses to execute a data-modifying
statement inside a non-volatile function, `EXECUTE` included. A string that
beats the regex still cannot write." That was written from plausibility and is
half wrong. What the probes against this project actually found:

```sql
-- refused, as claimed
execute 'insert into public.categories ...'
  => ERROR: INSERT is not allowed in a non-volatile function

-- ALLOWED — a SELECT calling a volatile function that writes internally
execute 'select public.some_volatile_function_that_writes()'
  => row inserted
```

So `stable` stops DML. It does not stop a *call*. That left
`select public.delete_own_account()` reachable: it names no forbidden keyword
(`\bdelete\b` finds no word boundary inside `delete_own_account`) and touches
no relation, so nothing in layer 1 saw it either. RLS bounded the damage to the
asking user's own account — which is still their whole account.

`stable` is kept, because refusing DML is worth having. It is no longer
described as the layer worth leaning on.

**3. `statement_timeout` of 3s and a hard `LIMIT 500`.** The executor wraps the
model's SQL as a subquery and caps the result set at 500 rows. A runaway join
costs a timeout, not the request. The row cap also protects the context window:
ten thousand rows coming back is a worse problem than a slow query. When the
cap truncates, the tool result says so, so the model narrows or aggregates
rather than reporting a total it only partly saw.

Rows are the wrong unit for the context problem, though, so the tool trims the
result a second time by **bytes** (48KB) before it reaches the model. 500 rows
of a thirty-column view is a six-figure token count: it would spend the
inference budget shipping a table nobody asked for, and push the schema document
out of the model's attention on the step that needs it most.

**4. RLS.** `security invoker` means it runs as `authenticated` under the
caller's `auth.uid()`, the same mechanism every screen already trusts. No
service-role key appears anywhere on this path.

RLS is what stops one user reading another's finances. It is unrelated to the
write problem layer 2 failed to solve — a distinction worth keeping straight,
because it is the reason the write hole was survivable: the damage was always
bounded to the asking user's own data.

### A least-privilege executor role: attempted, abandoned

The obvious answer to layer 2's gap is to stop pattern-matching for dangerous
calls and remove the privilege instead: run `ask_query` as a role that holds
`SELECT` on the four `q_` views and `EXECUTE` on nothing. It was built, and it
does not work. Recorded here so nobody rebuilds it.

Three attempts, each failing on a real prerequisite:

1. `alter function ... owner to ask_executor` → *must be able to SET ROLE.*
   Creating a role does not let its creator set it. Fixable: `grant
   ask_executor to current_user`.
2. Same statement → *permission denied for schema public.* The incoming owner
   also needs `CREATE` on the schema. Fixable: grant it for the two statements
   that need it, revoke immediately after.
3. **Not fixable.** The role must be a member of `authenticated`, or the
   existing `to authenticated` policies match nothing and every query returns
   zero rows. But membership inherits privileges by default, so the role
   inherits `authenticated`'s `EXECUTE` on `delete_own_account` and the rest —
   exactly what the role existed to prevent. `NOINHERIT` fixes the privilege
   leak and breaks RLS, because policy matching uses `has_privs_of_role()`,
   which respects `INHERIT`.

The two requirements are in direct conflict. The migration would have applied
cleanly, asserted its own success, and delivered close to nothing — a control
that reports itself as working is worse than an absent one.

**What would actually work**, if this is ever worth revisiting: give the `q_`
views `security_invoker = false` and an explicit
`where user_id = (select auth.uid())` filter in each. The views then run as
their owner, per-user scoping moves from RLS into the view definition, and the
executor role needs only `SELECT` on four views — no `authenticated`
membership, so no inheritance to leak through. The cost is that correctness
stops being RLS's job and becomes four `where` clauses nobody may ever omit.
That trade is defensible but it is a redesign of layer 4 and of the view layer
together, not a migration.

**Until then, layer 1 is the only control on which functions may be called.**
That is a single app-side parser guarding a destructive RPC, and it should be
read as exactly that thin. It earns some confidence from having been attacked
rather than only reviewed — the quoted-identifier bypasses in
`lib/ask/guard.test.ts` were live holes in the reviewed version — but a parser
is not a privilege boundary.

**Method, since this section is where the design failed twice.** A claim about
how Postgres behaves is an empirical question, not a design decision, and this
document reached for confident phrasing before running the experiment — first
on `stable`, then very nearly on the executor role, whose write-up asserted
properties that turned out to be mutually exclusive. The rule going forward: a
security property gets probed on the live project before it is written down as
load-bearing, and the probe's output goes in the spec next to the claim.

### Errors are a feature

A failed query returns its Postgres message as the tool result and the loop
tries again. For free-form SQL this is essential rather than defensive: first
attempts get a column name wrong, and self-correction on the next step is the
difference between "I could not answer that" and a right answer a second later.

### One accepted risk

Transaction descriptions come from LLM-parsed PDFs, so a hostile string could
in principle try to steer a query. With layers 1 and 4 in place the worst case
is a wrong answer about the user's own data. Recorded and accepted; sanitising
machinery would cost more than the risk.

That conclusion is unchanged from the first draft, but the reasoning behind it
is not, and the difference is worth keeping. The original read "read-only plus
RLS bounds the worst case — no exfiltration, no writes," and "no writes" was an
assumption inherited from the layer-2 claim, not something checked. It was
false when written: a prompt-injected `select public.delete_own_account()` would
have gone through. The risk is acceptable now because a specific control makes
it so, not because the path was ever inherently safe.

### Cost and abuse

Every other inference in this app is triggered by writing something down — a
card, a subscription, a saved transaction — so using the product paces the
spend. A text box has no such shape: holding Enter is an ordinary thing for a
person to do, and the loop — up to seven inference turns — is the most expensive
call in the codebase.

So the route validates before it spends: at most 24 messages, 4KB each, parsed
rather than trusted (the transcript is replayed into the prompt, so an
unvalidated `messages` array is a thousand forged turns transcribed into the
model's context). And it rate-limits per user, 20 requests per five minutes,
counting the warming calls.

That limiter is in memory, per instance, on purpose. A counter table would put
an INSERT on the one path whose entire promise is that it cannot write. Under
Fluid Compute one instance serves many requests, so it catches the case it aims
at — one person hammering one box — and undercounts across a fleet.
Undercounting a bill is acceptable; writing to the database here is not. A
proper limiter belongs in front of the app, not inside the guarantee.

## The loop

```ts
// lib/ask/tools.ts
askQuery: tool({
  description: "Run one read-only SQL SELECT against the q_ views.",
  inputSchema: z.object({
    sql: z.string(),
    purpose: z.string().describe("One line: what this query is for."),
  }),
  execute: ...
})
```

`streamText` with `stopWhen: stepCountIs(7)`. Six of those steps are the queries
the prompt promises; the seventh is the turn the model needs to WRITE the answer
once it has rows. The step budget must always be one larger than the query
budget, or a question that uses every query ends on a tool result with no prose
after it. The UI names that state anyway (`Ask.noAnswer`), because a loop can
still run out on a bad day and an empty card reads as the app losing the answer.

Three and then four were both too few, and widening was only half the fix. The
observed failure was never one bad query — it was a model exploring: a call to
find an account, a call to see what a column holds, a call refused for asking two
things at once, and the answer's turn already gone. What it lacked was not room
but information: `stopWhen` is invisible from inside the conversation, and a
number in the system prompt is bookkeeping across turns, which is what models are
worst at.

So every tool result carries `calls_left`, and the last one carries an
instruction rather than a number — *answer now, from the rows you already have*.
Two fields on a result the model is already reading, and the difference between a
transcript that stops mid-plan and one that lands.

`purpose` costs almost nothing and pays for itself twice: it sharpens the SQL,
and it is the copy the loading state renders (see below). It is not a debug
field that happens to be visible — it is the user-facing narration.

## What the model is told

Everything ambient is injected server-side, never guessed:

- **Today's date.** First and most important. Ask a model what day it is and it
  answers from training data, silently corrupting every "last month" and "this
  week" question in the product.
- **Base currency** from `profiles`.
- **Locale**, since the app is bilingual and the answer must come back in the
  language being read. Same `LANGUAGE` map as
  `lib/overview/recommendation/llm.ts`.

### The schema document

`lib/ask/schema-doc.md`, read at request time and appended to the system
prompt: the four views, every column, and prose for what SQL cannot express —
that `budget_spend` is what the budget screens count and `cash_out` is what
left the account, that a credit-card expense is borrowed rather than spent,
that accounts resolve by name, brand, or last4.

A file rather than a template literal because it is the highest-churn artifact
in the feature. Every wrong answer's fix is a sentence there, not a code
change. It lives beside the migration so the two move together.

## Model and budget

`gemini-3.6-flash`, behind its own `GOOGLE_ASK_MODEL` env var rather than the
shared `GOOGLE_MODEL`. The other four call sites do far easier work and should
not be dragged up in cost by this one. `gemini-3.5-flash` is the fallback if
3.6 is not enabled on the key — a typed model ID means the SDK knows it, not
that the project has access, so confirm with one call first.

Flash rather than Pro: better SQL is not worth a single call that can spend the
entire budget on its own. This is an interactive box.

```ts
// lib/llm/budget.ts
export const CHAT_INFERENCE_BUDGET_MS = 45_000;
```

45s covering the whole multi-step loop, against a 3s per-query
`statement_timeout` so one slow query cannot consume the window.

It started at 15s, on the reasoning that a chat which answers in eight seconds
and sometimes gives up beats one that might answer in forty. That trade was
mispriced: the loop grew to seven turns with a database round-trip between each,
and what 15s bought was not a faster answer but *no* answer — a loop cut off
mid-plan renders "I ran out of tries", and someone who waited ten seconds for
that would rather have waited twenty-five and been told the number. The wait is
legible while it happens, which is what makes the longer ceiling affordable.

### The cold-start conflict

`lib/llm/budget.ts` already documents that the first inference call in a fresh
Node process takes **9 to 70 seconds** versus ~600ms warm, and that a plain
`fetch` to the host beforehand is enough to fix it.

A 45s cap still loses a bad cold call outright. The existing features hide this because
nothing waits on them — a card colour arrives late and nobody notices. Chat is
the one surface where a person sits watching a cursor.

So the route warms the process on page mount and again on input focus. The cold
call then happens while the user is still typing, and 15s is comfortable for
the warm call that follows. Without the warming fetch, expect the first
question after a quiet period to time out.

Two details decide whether that works, and the first draft got both wrong. The
warm handler must live in **the same route file** as the question — a `GET` on
`/api/ask`, not a neighbouring `/api/ask/warm` — because each route handler is
its own function instance, so warming the neighbour warms a process that will
never serve the question. And it must make a **real inference** (one token out),
not a bare `fetch` to the host: what is slow is the SDK's first call, not DNS.

## Loading state

Because the model supplies `purpose` with every query, there is no generic
spinner:

> *Finding your Amex Platinum…*
> *Pulling transactions for Aug 8–14…*

Each step replaces the last as tool calls stream in; the answer then streams
token by token beneath them. Time-to-first-*something* collapses to roughly the
first tool call, which is what stops the 15s ceiling from reading as a wait.

On timeout, not an error toast but a suggestion — "that one is taking too long,
try a narrower date range" — which is both true and actionable.

## Surface

- `app/api/ask/route.ts` — the app's first route handler, since streaming needs
  one. `POST` answers; `GET` warms the same instance.
- `app/(app)/ask/page.tsx` — transcript and input, following the existing
  section pattern.
- Nav entry alongside the other sections, **and one in the mobile header**. The
  bottom bar is a deliberate five-cell layout that Ask does not displace, and
  the sidebar carrying it is `hidden md:flex` — so without a header entry the
  feature is reachable on a phone only by typing the URL.
- `outputFileTracingIncludes` for `/api/ask` in `next.config.ts`. The schema
  document is read at request time through a runtime path, which the file tracer
  cannot see, so untraced it is absent from the deployed function and the first
  question throws ENOENT — while passing every test locally, where the repo is
  the filesystem. Same class of problem as pdfjs's `createRequire`, same fix.

## Testing

The model's output is not deterministic; everything around it is, and that is
where the tests go.

- **`lib/ask/guard.test.ts`** — the pre-flight, exhaustively. Writes rejected,
  multi-statement rejected, comment-smuggled writes rejected, `pg_catalog`
  rejected, base tables rejected, legitimate CTEs and joins across `q_` views
  accepted. This file is the security boundary in test form.
- **Migration-level** — the `stable` guarantee proven by a query that tries to
  write and is refused.
- **`lib/ask/schema-doc.test.ts`** — drift in **both** directions against the
  generated `lib/supabase/types.ts`: no column the document invents, and no
  column the views have that the document forgot (`user_id` excepted, since the
  document's first instruction is never to mention it). Both failures are
  silent and both read as the model being stupid — an invented column comes back
  as `column "x" does not exist` after the model confidently selected it, and a
  forgotten one is a question the feature quietly cannot answer. The second
  direction is also the forcing function: change a view, and the suite tells you
  the prose is now behind.
- **`lib/ask/tools.test.ts`** and **`lib/ask/rate-limit.test.ts`** — the byte cap
  trims and says so; the limiter counts per person and forgets across the
  window.
- **View semantics** — `budget_spend` reproduces `spend_distribution` for a
  given month, and `cash_out` reproduces `monthly_cashflow`. If the views
  disagree with the screens, the feature is wrong no matter what the model does.

## Copy and documentation

- `messages/en.json` and `messages/es.json` — page, input placeholder, loading
  narration, timeout and error copy, empty state.
- The in-app help guide gets the new section: what it can answer, that it is
  read-only, and that it is bounded to the user's own data. House rule — the
  guide moves with the feature.

## Migration and rollout

Two migrations, both pushed by hand against the live project:

1. `<ts>_ask_views.sql` — the four `q_` views.
2. `<ts>_ask_query.sql` — the executor function and its grants.

Followed by `npm run db:types`.

Expect the view layer to want a second round. The first version of a semantic
layer is never right, and the signal will be specific questions the model
answers badly — which is why `schema-doc.md` and the views are designed to be
edited together and often.
