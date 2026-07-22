# Statement Import Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the post-merge follow-up list from the statement-import feature (memory: `statement-import-followups`, spec: `docs/superpowers/specs/2026-07-22-statement-import-design.md`) — expandable line detail in statement history, a visible FX-fallback warning, storage cleanup on account deletion, a refund badge on negative imported rows, a wrong-password vs first-prompt distinction, a localized-date pass, and a fix for the success chime cutting off before it rings out.

**Architecture:** Small, independent changes layered on the existing statement-import code (`app/(app)/accounts/statement-actions.ts`, `components/accounts/statements-panel.tsx`, `components/transactions/transaction-row.tsx`) plus one schema migration (`fx_fallback` column + RPC update) and one generator-script tweak (`scripts/generate-sounds.mjs`). No new subsystems.

**Tech Stack:** Next.js App Router server actions, Supabase (Postgres + Storage + RLS, hosted project — no local stack), next-intl, Vitest.

## Global Constraints

- User decision (explicit, overrides spec §3.1/§6.1): **the app must not store the original statement PDF at all.** Remove the Storage upload in `confirmStatementImport`; statement history gets line detail, not a PDF link.
- All new/changed user-facing strings go in both `messages/en.json` and `messages/es.json` (existing project convention).
- This project's Supabase project is **hosted, not local** (no `supabase start`/docker stack wired to it) — `npm run db:push` applies migrations directly to the live database. **Do not run `db:push` without the user's explicit go-ahead in the moment**; writing the migration file is in scope for every task below, applying it to the remote project is a separate, confirmed step at the end.
- `lib/supabase/types.ts` is generated via `npm run db:types` against the *linked* project, so it will only reflect the new `fx_fallback` column after the migration above is actually pushed. Until then, hand-edit the one column into the existing generated file (Task 1) so the app compiles; regenerate for real after the push and confirm the hand-edit matches.
- This repo has no component/integration tests (server actions and `.tsx` files are verified by build + lint + manual/dev-server check, not Vitest) — only add Vitest tests for pure functions (`lib/format.ts`, `scripts/generate-sounds.mjs`), matching existing convention.
- Date-only ISO strings (`period_end`, `due_date`, `made_on`, …) must render in `timeZone: "UTC"` (see `components/accounts/balance-chart.tsx:11`) to avoid the classic off-by-one-day shift in negative-UTC-offset timezones.

---

### Task 1: `fx_fallback` column + RPC update + hand-typed DB types

**Files:**
- Create: `supabase/migrations/20260722160000_statement_fx_fallback.sql`
- Modify: `lib/supabase/types.ts:833` (transactions `Row`/`Insert`/`Update`, insert `fx_fallback` alphabetically after `fee_amount`)

**Interfaces:**
- Produces: `public.transactions.fx_fallback boolean not null default false` — a per-transaction flag set true when the statement-import RPC received `fx_fallback: true` for that line's section (spec §7: "FX rate unavailable at import: import proceeds with rate 1 and a visible warning").
- Produces: `public.import_card_statement(p jsonb)` now reads `sec->>'fx_fallback'` (a JSON boolean) and writes it onto every non-payment transaction generated from that section.
- Consumed by: Task 3 (sets `fx_fallback` in the RPC payload), Task 5 (`transaction-row.tsx` reads `txn.fx_fallback`).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260722160000_statement_fx_fallback.sql

-- FX-fallback warning (spec §7): when the exchange rate wasn't available at
-- import time, the section silently fell back to 1:1. Surface that on the
-- generated transactions so a fallback rate is never mistaken for a real one.
alter table public.transactions
  add column fx_fallback boolean not null default false;

create or replace function public.import_card_statement(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user     uuid := (select auth.uid());
  v_import   uuid;
  v_stmt     uuid;
  v_line     uuid;
  v_txn      uuid;
  sec        jsonb;
  ln         jsonb;
  v_account  uuid;
  v_currency text;
  v_movement numeric;
  v_computed numeric;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if nullif(p->>'card_group_id','') is not null then
    if not exists (
      select 1 from public.card_groups
      where id = (p->>'card_group_id')::uuid and user_id = v_user
    ) then
      raise exception 'card_group % does not belong to you', p->>'card_group_id';
    end if;
  end if;

  if (select count(*) from jsonb_array_elements(p->'sections') s) <>
     (select count(distinct s->>'account_id') from jsonb_array_elements(p->'sections') s) then
    raise exception 'duplicate account_id across sections: each section must import to a distinct credit line';
  end if;

  insert into public.statement_imports (user_id, parser_id, card_group_id, file_name, file_path)
  values (v_user, p->>'parser_id', nullif(p->>'card_group_id','')::uuid,
          p->>'file_name', nullif(p->>'file_path',''))
  returning id into v_import;

  for sec in select * from jsonb_array_elements(p->'sections') loop
    v_account := (sec->>'account_id')::uuid;
    select currency into v_currency from public.accounts
      where id = v_account and user_id = v_user and type = 'credit_card';
    if v_currency is null then
      raise exception 'account % is not one of your credit cards', v_account;
    end if;

    if (sec->>'previous_balance') is null
       or (sec->>'total_balance') is null
       or (sec->>'total_debits') is null
       or (sec->>'total_credits') is null then
      raise exception 'section % is missing balance fields required for checksum validation',
        sec->>'section_key';
    end if;

    -- Defense in depth: the statement's own arithmetic must tie before any
    -- write. previous + Σlines = closing when lines exist; stated totals
    -- otherwise (line-less sections like Cuotas). App-layer validation can
    -- be bypassed by calling this RPC directly, so the invariant lives here.
    if jsonb_array_length(coalesce(sec->'lines', '[]'::jsonb)) > 0 then
      select coalesce(sum((l->>'amount')::numeric), 0) into v_movement
      from jsonb_array_elements(sec->'lines') l;
    else
      v_movement := (sec->>'total_debits')::numeric - (sec->>'total_credits')::numeric;
    end if;
    v_computed := (sec->>'previous_balance')::numeric + v_movement;
    if v_computed <> (sec->>'total_balance')::numeric then
      raise exception 'section % checksum mismatch: computed % vs stated %',
        sec->>'section_key', v_computed, (sec->>'total_balance')::numeric;
    end if;

    delete from public.card_statements
      where account_id = v_account and period_end = (sec->>'period_end')::date;

    insert into public.card_statements (
      user_id, account_id, import_id, section_key, source,
      period_start, period_end, due_date,
      previous_balance, total_debits, total_credits,
      statement_balance, total_balance,
      minimum_payment, overdue_amount, overdue_installments,
      credit_limit, available_credit,
      interest_rate_annual, avg_daily_balance, avg_daily_balance_prior,
      cost_of_carry, cost_of_carry_prior
    ) values (
      v_user, v_account, v_import, sec->>'section_key', 'import',
      (sec->>'period_start')::date, (sec->>'period_end')::date,
      nullif(sec->>'due_date','')::date,
      (sec->>'previous_balance')::numeric,
      (sec->>'total_debits')::numeric, (sec->>'total_credits')::numeric,
      (sec->>'statement_balance')::numeric, (sec->>'total_balance')::numeric,
      nullif(sec->>'minimum_payment','')::numeric,
      nullif(sec->>'overdue_amount','')::numeric,
      nullif(sec->>'overdue_installments','')::integer,
      nullif(sec->>'credit_limit','')::numeric,
      nullif(sec->>'available_credit','')::numeric,
      nullif(sec->>'interest_rate_annual','')::numeric,
      nullif(sec->>'avg_daily_balance','')::numeric,
      nullif(sec->>'avg_daily_balance_prior','')::numeric,
      nullif(sec->>'cost_of_carry','')::numeric,
      nullif(sec->>'cost_of_carry_prior','')::numeric
    ) returning id into v_stmt;

    for ln in select * from jsonb_array_elements(sec->'lines') loop
      insert into public.card_statement_lines (
        user_id, statement_id, account_id, line_no, made_on, posted_on,
        reference, description, mcc, auth_code, amount, kind
      ) values (
        v_user, v_stmt, v_account,
        (ln->>'line_no')::integer, (ln->>'made_on')::date, (ln->>'posted_on')::date,
        nullif(ln->>'reference',''), ln->>'description',
        nullif(ln->>'mcc',''), nullif(ln->>'auth_code',''),
        (ln->>'amount')::numeric, (ln->>'kind')::public.statement_line_kind
      ) returning id into v_line;

      if (ln->>'kind') <> 'payment' then
        if not exists (
          select 1 from public.categories
          where id = (ln->>'category_id')::uuid and user_id = v_user
        ) then
          raise exception 'category % does not belong to you', ln->>'category_id';
        end if;

        insert into public.transactions (
          user_id, type, account_id, category_id, amount, currency, exchange_rate,
          fx_fallback, occurred_at, description, statement_line_id
        ) values (
          v_user, 'expense', v_account, (ln->>'category_id')::uuid,
          (ln->>'amount')::numeric, v_currency,
          coalesce(nullif(sec->>'exchange_rate','')::numeric, 1),
          coalesce((sec->>'fx_fallback')::boolean, false),
          (ln->>'made_on')::timestamptz, ln->>'description', v_line
        ) returning id into v_txn;

        update public.card_statement_lines set transaction_id = v_txn where id = v_line;
      end if;
    end loop;

    perform public.recompute_card_balance(v_account);
  end loop;

  return v_import;
end;
$$;
revoke execute on function public.import_card_statement(jsonb) from anon;
```

- [ ] **Step 2: Hand-edit `lib/supabase/types.ts` so the app compiles before the migration is pushed**

In the `transactions` table's `Row`, `Insert`, and `Update` blocks (around line 821), add `fx_fallback` right after `fee_amount` (alphabetical, matching the existing ordering):

```ts
        Row: {
          account_id: string
          amount: number
          base_amount: number
          base_total_amount: number
          budget_only: boolean
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          exchange_rate: number
          fee_amount: number
          fx_fallback: boolean
          id: string
          ...
        Insert: {
          account_id: string
          amount: number
          base_amount?: number
          base_total_amount?: number
          budget_only?: boolean
          category_id?: string | null
          created_at?: string
          currency: string
          description?: string | null
          exchange_rate?: number
          fee_amount?: number
          fx_fallback?: boolean
          id?: string
          ...
        Update: {
          account_id?: string
          amount?: number
          base_amount?: number
          base_total_amount?: number
          budget_only?: boolean
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          exchange_rate?: number
          fee_amount?: number
          fx_fallback?: boolean
          id?: string
          ...
```

- [ ] **Step 3: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors (this only adds an optional/defaulted field, nothing consumes it yet).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260722160000_statement_fx_fallback.sql lib/supabase/types.ts
git commit -m "feat(statements): add fx_fallback column + RPC support"
```

---

### Task 2: `formatDate` helper (localized, UTC-safe)

**Files:**
- Modify: `lib/format.ts`
- Test: `lib/format.test.ts` (new)

**Interfaces:**
- Produces: `formatDate(iso: string, locale: string, opts?: Intl.DateTimeFormatOptions): string` — formats a `yyyy-mm-dd` date string in the given locale without a timezone-shift bug.
- Consumed by: Task 3/4 (`statements-panel.tsx`), Task 6 (`accounts/[id]/page.tsx`, `insights/page.tsx`).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/format.test.ts
import { expect, test } from "vitest";
import { formatDate } from "./format";

test("formats an ISO date in the given locale", () => {
  expect(formatDate("2026-07-22", "en")).toBe("Jul 22, 2026");
  expect(formatDate("2026-07-22", "es")).toBe("22 jul 2026");
});

test("never shifts the date across a UTC-offset boundary", () => {
  // A date-only string must render the same calendar day regardless of the
  // machine's local timezone — this is what timeZone: "UTC" buys us.
  const result = formatDate("2026-01-01", "en");
  expect(result).toBe("Jan 1, 2026");
});

test("accepts custom Intl.DateTimeFormat options", () => {
  expect(formatDate("2026-07-22", "en", { month: "short", day: "numeric" })).toBe("Jul 22");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/format.test.ts`
Expected: FAIL — `formatDate` is not exported from `./format`.

- [ ] **Step 3: Implement `formatDate`**

Add to `lib/format.ts` (after the existing `formatDayOfMonth`):

```ts
/**
 * Formats a `yyyy-mm-dd` date string in the given locale. Always resolves in
 * UTC so a date-only value renders the same calendar day no matter the
 * viewer's local timezone (see components/accounts/balance-chart.tsx for the
 * same pattern applied ad hoc before this helper existed).
 */
export function formatDate(
  iso: string,
  locale: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/format.test.ts`
Expected: PASS (3 tests). If the `es` locale's medium `dateStyle` output differs slightly from `"22 jul 2026"` in this Node's ICU data, adjust the expectation to match the actual output rather than the format string — the invariant that matters is "no day shift" and "locale-sensitive," not the exact separator.

- [ ] **Step 5: Commit**

```bash
git add lib/format.ts lib/format.test.ts
git commit -m "feat(format): add locale- and timezone-safe formatDate helper"
```

---

### Task 3: `statement-actions.ts` — drop PDF storage, fx_fallback payload, wrong-password distinction, line detail query

**Files:**
- Modify: `app/(app)/accounts/statement-actions.ts`
- Modify: `docs/superpowers/specs/2026-07-22-statement-import-design.md` (small addendum — spec no longer matches the app on PDF storage)

**Interfaces:**
- Consumes: `extractStatementText` already returns `reason: "bad_password"` vs `"password_required"` (`lib/statements/extract.ts:14`) — currently collapsed; this task un-collapses it.
- Produces: `StatementPreviewResult.passwordIncorrect?: boolean` (new field alongside existing `needsPassword?: boolean`).
- Produces: `getStatementLineDetail(statementId: string): Promise<StatementLineDetail[]>` — new export, `StatementLineDetail = { id: string; lineNo: number; madeOn: string; description: string; mcc: string | null; amount: number; kind: "purchase" | "fee" | "credit" | "payment" }`.
- Consumed by: Task 4 (`statements-panel.tsx` uses `passwordIncorrect` and `getStatementLineDetail`).

- [ ] **Step 1: Remove the PDF upload and stop persisting a file path**

In `confirmStatementImport`, delete this block entirely:

```ts
  // Store the original file (still encrypted if it was) in the private bucket.
  const filePath = `${user.id}/${parsed.sections[0].periodEnd}-${parser.id}-${parsed.cardLast4 ?? "xxxx"}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("statements")
    .upload(filePath, bytes, { contentType: "application/pdf", upsert: true });
  // Upload failure is non-fatal: the import is the point; the file is a nicety.
  const storedPath = uploadError ? "" : filePath;
```

Change the payload's `file_path` field:

```ts
    file_path: "",
```

Remove `bytes` from the destructure at the top of `confirmStatementImport` (it's now unused there — `bytes` is still read inside `runPipeline` for extraction, just not re-used by the caller):

```ts
  const { supabase, user, parsed, parser, account, options, file, t } = ctx;
```

- [ ] **Step 2: Distinguish wrong password from first-time prompt**

In `runPipeline`, replace:

```ts
  const extracted = await extractStatementText(bytes, password);
  if (!extracted.ok) {
    if (extracted.reason === "unreadable") return { error: t("unreadablePdf") } as const;
    return { needsPassword: true } as const;
  }
```

with:

```ts
  const extracted = await extractStatementText(bytes, password);
  if (!extracted.ok) {
    if (extracted.reason === "unreadable") return { error: t("unreadablePdf") } as const;
    if (extracted.reason === "bad_password") return { needsPassword: true, passwordIncorrect: true } as const;
    return { needsPassword: true } as const;
  }
```

Add the new field to the result interface:

```ts
export interface StatementPreviewResult {
  error?: string;
  needsPassword?: boolean;
  passwordIncorrect?: boolean;
  preview?: {
    ...
```

- [ ] **Step 3: Compute and pass `fx_fallback` per section**

In `confirmStatementImport`, inside the `payload.sections` map, change:

```ts
      const rate = s.currency === baseCurrency ? 1 : rates[s.currency] ? 1 / rates[s.currency] : 1;
      return {
        account_id: mappings[s.sectionKey],
```

to:

```ts
      const rate = s.currency === baseCurrency ? 1 : rates[s.currency] ? 1 / rates[s.currency] : 1;
      const fxFallback = s.currency !== baseCurrency && !rates[s.currency];
      return {
        account_id: mappings[s.sectionKey],
```

and add the field alongside `exchange_rate` further down in the same object:

```ts
        exchange_rate: String(rate),
        fx_fallback: fxFallback,
```

- [ ] **Step 4: Add the line-detail query for statement history**

Add near the bottom of the file, after `saveMerchantRule`:

```ts
export interface StatementLineDetail {
  id: string;
  lineNo: number;
  madeOn: string;
  description: string;
  mcc: string | null;
  amount: number;
  kind: "purchase" | "fee" | "credit" | "payment";
}

export async function getStatementLineDetail(statementId: string): Promise<StatementLineDetail[]> {
  const { supabase, user } = await requireUser();
  if (!user) return [];
  const { data } = await supabase
    .from("card_statement_lines")
    .select("id,line_no,made_on,description,mcc,amount,kind")
    .eq("statement_id", statementId)
    .order("line_no");
  return (data ?? []).map((l) => ({
    id: l.id,
    lineNo: l.line_no,
    madeOn: l.made_on,
    description: l.description,
    mcc: l.mcc,
    amount: l.amount,
    kind: l.kind,
  }));
}
```

(RLS on `card_statement_lines` already scopes to owner — see `20260722120000_statement_import.sql` — so no explicit `user_id` filter is needed, matching every other query in this file.)

- [ ] **Step 5: Update the spec doc's PDF-storage section to match reality**

In `docs/superpowers/specs/2026-07-22-statement-import-design.md`, after §3.1's Storage paragraph (the one starting "The original PDF is stored as uploaded…"), add:

```markdown
> **Amended 2026-07-22 (post-merge):** the app no longer stores the original
> PDF at all — it's read once for text extraction and discarded. Statement
> history offers expandable line detail (§6.1) instead of a stored-PDF link.
> The `statements` Storage bucket and its RLS policies remain, unused by new
> imports, solely so `deleteAccount` can purge any files left over from
> imports made before this change.
```

- [ ] **Step 6: Type-check and run existing statement tests**

Run: `npx tsc --noEmit && npx vitest run lib/statements`
Expected: no errors; existing statement unit tests still pass (they don't touch `statement-actions.ts` directly, which has no unit tests in this repo — verified manually via the dev server in Task 7's checkpoint).

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/accounts/statement-actions.ts" docs/superpowers/specs/2026-07-22-statement-import-design.md
git commit -m "feat(statements): stop storing PDFs, add fx_fallback + wrong-password + line-detail support"
```

---

### Task 4: `statements-panel.tsx` — expandable line detail, wrong-password UI, localized dates

**Files:**
- Modify: `components/accounts/statements-panel.tsx`
- Modify: `messages/en.json`, `messages/es.json` (`Statements` namespace)

**Interfaces:**
- Consumes: `getStatementLineDetail`, `StatementLineDetail`, `passwordIncorrect` from Task 3; `formatDate` from Task 2.

- [ ] **Step 1: Add the new translation keys**

In `messages/en.json`, inside `"Statements"` (after `"passwordHint"`):

```json
    "passwordIncorrect": "Incorrect password. Try again.",
```

and after `"deleteConfirmTitle"` (before the closing `}` of the `Statements` block — remember to add a comma after `deleteConfirmTitle`'s value):

```json
    "viewLinesAria": "Show line detail for this statement",
    "hideLinesAria": "Hide line detail",
    "linesLoading": "Loading lines…",
    "linesEmpty": "No lines recorded for this statement.",
    "linePaymentBadge": "Payment (skipped)"
```

In `messages/es.json`, the same keys, same positions:

```json
    "passwordIncorrect": "Contraseña incorrecta. Inténtalo de nuevo.",
```

```json
    "viewLinesAria": "Mostrar detalle de líneas de este estado de cuenta",
    "hideLinesAria": "Ocultar detalle de líneas",
    "linesLoading": "Cargando líneas…",
    "linesEmpty": "No hay líneas registradas para este estado de cuenta.",
    "linePaymentBadge": "Pago (omitido)"
```

Also add to the `"Transactions"` namespace in both files (needed here for the refund badge on line detail, and again in Task 5 for the ledger — one shared key, defined once):

`en.json`, after `"statementBadge": "Statement",`:
```json
    "refundBadge": "Refund",
```

`es.json`, after `"statementBadge": "Estado",`:
```json
    "refundBadge": "Reembolso",
```

- [ ] **Step 2: Wire up imports and new state**

At the top of `components/accounts/statements-panel.tsx`, update imports:

```ts
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { Upload, Trash2, FileText, ChevronDown, ChevronRight } from "lucide-react";
import {
  parseStatement,
  confirmStatementImport,
  deleteCardStatement,
  getStatementLineDetail,
  type StatementPreviewResult,
  type StatementLineDetail,
} from "@/app/(app)/accounts/statement-actions";
import type { CardStatementRow } from "@/lib/accounts/queries";
import { formatMoney, formatDate } from "@/lib/format";
import { useUiSound } from "@/components/sound/sound-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
```

Inside the component, after the existing `useState` calls, add:

```ts
  const tTxn = useTranslations("Transactions");
  const locale = useLocale();
  const [passwordIncorrect, setPasswordIncorrect] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, StatementLineDetail[]>>({});
```

(`tTxn` and `locale` go next to the existing `const t = useTranslations("Statements");` / `const tc = useTranslations("Common");` lines.)

- [ ] **Step 3: Reset and set `passwordIncorrect` in the parse flow**

In the file-input `onChange` handler, add a reset alongside the existing ones:

```ts
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!f) return;
            setFile(f);
            setPassword("");
            setNeedsPassword(false);
            setPasswordIncorrect(false);
            setPreview(null);
            onParse(f);
          }}
```

In `onParse`, change the `needsPassword` branch and the success branch:

```ts
  function onParse(f: File) {
    startTransition(async () => {
      const result = await parseStatement(buildFormData(f));
      if (result.needsPassword) {
        setNeedsPassword(true);
        setPasswordIncorrect(!!result.passwordIncorrect);
        if (result.passwordIncorrect) setPassword("");
        return;
      }
      if (result.error || !result.preview) {
        toast.error(result.error ?? t("parseFailed"));
        playError();
        return;
      }
      setNeedsPassword(false);
      setPasswordIncorrect(false);
      setPreview(result.preview);
      setMappings(
        Object.fromEntries(
          result.preview.sections
            .map((s) => [s.sectionKey, s.mappedAccountId ?? s.suggestedAccountId ?? ""])
            .filter(([, v]) => v),
        ),
      );
    });
  }
```

- [ ] **Step 4: Render the wrong-password vs first-prompt copy, and localize the preview dates**

Replace the password-prompt block:

```tsx
      {needsPassword && file ? (
        <div className="mt-5 space-y-2">
          <Label htmlFor="stmt-password">{t("passwordLabel")}</Label>
          <p className={cn("text-xs", passwordIncorrect ? "text-destructive" : "text-muted-foreground")}>
            {passwordIncorrect ? t("passwordIncorrect") : t("passwordHint")}
          </p>
          <div className="flex gap-2">
            <Input
              id="stmt-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button variant="outline" disabled={pending || !password} onClick={() => onParse(file)}>
              {t("retryButton")}
            </Button>
          </div>
        </div>
      ) : null}
```

In the preview section header, replace:

```tsx
                <p className="text-sm font-medium">
                  {s.sectionKey} · {s.currency} · {s.periodStart} → {s.periodEnd}
                </p>
```

with:

```tsx
                <p className="text-sm font-medium">
                  {s.sectionKey} · {s.currency} · {formatDate(s.periodStart, locale)} →{" "}
                  {formatDate(s.periodEnd, locale)}
                </p>
```

- [ ] **Step 5: Localize the statement-history dates and add the expand toggle + line detail**

Replace the `dueLabel` line:

```tsx
                    {s.due_date ? t("dueLabel", { date: s.due_date }) : null}
```

with:

```tsx
                    {s.due_date ? t("dueLabel", { date: formatDate(s.due_date, locale) }) : null}
```

Replace the whole `<li>` for each statement (currently ending in the `Trash2` delete button) with a version that localizes `period_end` and adds the expand toggle + expandable detail:

```tsx
          {statements.map((s) => (
            <li key={s.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <FileText className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {formatDate(s.period_end, locale)}
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {s.source === "import" ? t("sourceImport") : t("sourceManual")}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.due_date ? t("dueLabel", { date: formatDate(s.due_date, locale) }) : null}
                      {s.minimum_payment != null
                        ? ` · ${t("minimumLabel", { amount: formatMoney(Number(s.minimum_payment), currency) })}`
                        : null}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="figure text-sm">{formatMoney(Number(s.total_balance), currency)}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    aria-label={expanded === s.id ? t("hideLinesAria") : t("viewLinesAria")}
                    onClick={() => onToggleLines(s.id)}
                  >
                    {expanded === s.id ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => setDeleteTarget(s.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              {expanded === s.id ? (
                <div className="mt-3 space-y-1.5 border-t pt-3">
                  {lines[s.id] === undefined ? (
                    <p className="text-xs text-muted-foreground">{t("linesLoading")}</p>
                  ) : lines[s.id].length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("linesEmpty")}</p>
                  ) : (
                    lines[s.id].map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1 truncate">
                          <span className="text-muted-foreground">{formatDate(l.madeOn, locale)}</span>{" "}
                          <span className="text-foreground">{l.description}</span>
                          {l.kind === "payment" ? (
                            <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[9px] uppercase text-muted-foreground">
                              {t("linePaymentBadge")}
                            </span>
                          ) : l.amount < 0 ? (
                            <span className="ml-1.5 rounded bg-success/10 px-1 py-0.5 text-[9px] uppercase text-success">
                              {tTxn("refundBadge")}
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "figure shrink-0 tabular-nums",
                            l.amount < 0 ? "text-success" : "text-foreground",
                          )}
                        >
                          {formatMoney(l.amount, currency, { signed: true })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </li>
          ))}
```

Add the `onToggleLines` handler next to `onDelete`:

```ts
  function onToggleLines(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!lines[id]) {
      startTransition(async () => {
        const detail = await getStatementLineDetail(id);
        setLines((prev) => ({ ...prev, [id]: detail }));
      });
    }
  }
```

- [ ] **Step 6: Localize the account-page anchor date (same component tree, quick pass)**

Skip — that string lives in `app/(app)/accounts/[id]/page.tsx`, handled in Task 6.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual verification (no component tests in this repo)**

Run: `npm run dev`, open an account with at least one imported statement, and confirm: the history row's date is localized, the chevron expands to show line detail with dates/descriptions/amounts, refund lines (if any) show the green "Refund" badge, payment lines show "Payment (skipped)", and uploading a PDF with the wrong password shows the red "Incorrect password" copy on retry (vs the neutral hint on first prompt).

- [ ] **Step 9: Commit**

```bash
git add components/accounts/statements-panel.tsx messages/en.json messages/es.json
git commit -m "feat(statements): expandable line detail, wrong-password copy, localized dates"
```

---

### Task 5: `transaction-row.tsx` — FX-fallback warning + refund/credit badge and tone

**Files:**
- Modify: `components/transactions/transaction-row.tsx`
- Modify: `messages/en.json`, `messages/es.json` (`Transactions` namespace)

**Interfaces:**
- Consumes: `txn.fx_fallback: boolean`, `txn.statement_line_id`, `txn.amount`, `txn.total_amount` (all already present on `TransactionWithRefs` — `fx_fallback` via Task 1's type edit, the rest pre-existing).

- [ ] **Step 1: Add translation keys**

`messages/en.json`, in `"Transactions"`, after the `"refundBadge"` key added in Task 4:

```json
    "fxFallbackBadge": "FX fallback",
    "fxFallbackWarning": "Exchange rate was unavailable at import time; this transaction uses a 1:1 fallback rate instead of the real rate.",
```

(both keys land before the existing `"transactionFallbackTitle"` key, so `fxFallbackWarning` needs the trailing comma shown above)

`messages/es.json`, in `"Transactions"`, after `"refundBadge"`:

```json
    "fxFallbackBadge": "TC alterno",
    "fxFallbackWarning": "La tasa de cambio no estaba disponible al importar; esta transacción usa una tasa alterna de 1:1 en lugar de la tasa real.",
```

- [ ] **Step 2: Import the warning icon**

```ts
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Trash2, Pencil, TriangleAlert } from "lucide-react";
```

- [ ] **Step 3: Compute the credit/refund flag and fix the amount tone**

Replace:

```ts
  const amount =
    txn.type === "income"
      ? { value: txn.amount, signed: true, tone: "text-success" }
      : txn.type === "expense"
        ? { value: -txn.total_amount, signed: false, tone: "text-destructive" }
        : { value: txn.total_amount, signed: false, tone: "text-foreground" };
```

with:

```ts
  // A statement-sourced expense row can carry a negative amount (refund,
  // rebate, reversal — spec §2.3). "-total_amount" would then be positive
  // and render as an ordinary red charge, backwards from what happened.
  const isStatementCredit =
    txn.type === "expense" && !!txn.statement_line_id && Number(txn.total_amount) < 0;

  const amount = isStatementCredit
    ? { value: -txn.total_amount, signed: true, tone: "text-success" }
    : txn.type === "income"
      ? { value: txn.amount, signed: true, tone: "text-success" }
      : txn.type === "expense"
        ? { value: -txn.total_amount, signed: false, tone: "text-destructive" }
        : { value: txn.total_amount, signed: false, tone: "text-foreground" };
```

- [ ] **Step 4: Add the refund and FX-fallback badges next to the existing statement badge**

Replace:

```tsx
          {txn.statement_line_id ? (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("statementBadge")}
            </span>
          ) : null}
```

with:

```tsx
          {txn.statement_line_id ? (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("statementBadge")}
            </span>
          ) : null}
          {isStatementCredit ? (
            <span className="ml-2 rounded bg-success/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-success">
              {t("refundBadge")}
            </span>
          ) : null}
          {txn.fx_fallback ? (
            <span
              className="ml-2 inline-flex items-center gap-0.5 rounded bg-warning/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-warning"
              title={t("fxFallbackWarning")}
            >
              <TriangleAlert className="size-3" />
              {t("fxFallbackBadge")}
            </span>
          ) : null}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open Transactions, and check a refund/credit line (or import a statement fixture with one) shows a green amount with the "Refund" badge, and any FX-fallback transaction (currency ≠ base with no rate available) shows the amber "FX fallback" badge with the tooltip text on hover.

- [ ] **Step 7: Commit**

```bash
git add components/transactions/transaction-row.tsx messages/en.json messages/es.json
git commit -m "feat(transactions): refund badge + fx-fallback warning, fix credit-row tone"
```

---

### Task 6: Localize the remaining raw-ISO-date call sites

**Files:**
- Modify: `app/(app)/accounts/[id]/page.tsx`
- Modify: `app/(app)/insights/page.tsx`

**Interfaces:**
- Consumes: `formatDate` from Task 2.

- [ ] **Step 1: `accounts/[id]/page.tsx`**

Update the import:

```ts
import { getTranslations, getLocale } from "next-intl/server";
```

```ts
import { formatMoney, formatPercent, formatDayOfMonth, formatDate } from "@/lib/format";
```

Add `const locale = await getLocale();` next to the existing `const t = await getTranslations("AccountDetail");` line, then replace:

```tsx
            {statements[0] ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("anchoredToStatement", { date: statements[0].period_end })}
              </p>
            ) : null}
```

with:

```tsx
            {statements[0] ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("anchoredToStatement", { date: formatDate(statements[0].period_end, locale) })}
              </p>
            ) : null}
```

- [ ] **Step 2: `insights/page.tsx`**

Update the import:

```ts
import { getTranslations, getLocale } from "next-intl/server";
```

```ts
import { formatMoney, formatDate } from "@/lib/format";
```

Add `const locale = await getLocale();` next to `const t = await getTranslations("Insights");`, then replace:

```tsx
                    {t("costOfCarryAsOf", { date: l.periodEnd })}
```

with:

```tsx
                    {t("costOfCarryAsOf", { date: formatDate(l.periodEnd, locale) })}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open a credit-card account's detail page and the Insights page (with at least one imported statement / cost-of-carry line), switch the language toggle between English and Spanish, and confirm both dates render as localized dates (not raw `2026-07-22`).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/accounts/[id]/page.tsx" "app/(app)/insights/page.tsx"
git commit -m "feat(dates): localize the remaining raw-ISO-date call sites"
```

---

### Task 7: Purge orphaned statement files on account deletion

**Files:**
- Modify: `app/(app)/settings/actions.ts`

**Interfaces:**
- Consumes: existing `statements` Storage bucket + its owner-scoped RLS policies (`20260722120000_statement_import.sql`) — no schema change needed, this is app code only.

- [ ] **Step 1: Purge the user's `statements/{uid}/` folder before deleting the account**

Replace:

```ts
export async function deleteAccount(): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  // Cascades through every user-owned table — see the migration for detail.
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { error: await dbError(error, "deleteAccount") };

  await supabase.auth.signOut();
  return {};
}
```

with:

```ts
export async function deleteAccount(): Promise<{ error?: string }> {
  const t = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  // Storage isn't part of the auth.users cascade, and once the row is gone
  // (or the session invalidated) RLS can no longer prove ownership of these
  // objects — a CLI/admin cleanup afterwards silently no-ops on them. Purge
  // while the session still resolves auth.uid() to this user. Files here are
  // leftovers from imports made before the app stopped storing statement
  // PDFs entirely; non-fatal, the account deletion is what matters.
  const { data: files } = await supabase.storage.from("statements").list(user.id);
  if (files?.length) {
    await supabase.storage.from("statements").remove(files.map((f) => `${user.id}/${f.name}`));
  }

  // Cascades through every user-owned table — see the migration for detail.
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { error: await dbError(error, "deleteAccount") };

  await supabase.auth.signOut();
  return {};
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Since this only matters for accounts with a pre-existing `statements/{uid}/…` object (none should exist going forward after Task 3 removes the upload), verify by hand against the live Supabase project: upload a statement under a disposable test user (temporarily, before Task 3 lands, or by uploading directly via the Storage UI), then delete that account from Settings, and confirm via the Supabase Storage browser that `statements/{uid}/` is empty afterward.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/settings/actions.ts"
git commit -m "fix(settings): purge orphaned statement files on account deletion"
```

---

### Task 8: Fix the success chime cutting off before it rings out

**Files:**
- Modify: `scripts/generate-sounds.mjs`
- Modify: `scripts/generate-sounds.test.ts`
- Regenerate: `public/sounds/success.wav` (binary, via the script — `delete.wav`/`error.wav` are untouched)

**Interfaces:** none (self-contained asset generator).

- [ ] **Step 1: Write the failing test locking in a minimum ring-out duration**

Add to `scripts/generate-sounds.test.ts`, after the existing `for (const file of SOUND_FILES) { ... }` loop:

```ts
test("public/sounds/success.wav rings long enough to resolve, not chop", () => {
  // The success cue is a two-note rising gesture (E5 → B5); the second note
  // needs real time to ring out or the whole thing reads as cut off rather
  // than finished. 1s is comfortably past the ~0.83s the too-fast version
  // used to run for.
  const buffer = readFileSync(join(process.cwd(), "public/sounds", "success.wav"));
  const numSamples = (buffer.length - 44) / 2;
  const durationMs = (numSamples / 44100) * 1000;
  expect(durationMs).toBeGreaterThan(1000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/generate-sounds.test.ts`
Expected: FAIL on the new test — current `success.wav` is ~835ms.

- [ ] **Step 3: Slow the success chime's decay and lengthen its notes**

In `scripts/generate-sounds.mjs`, replace:

```js
/* Success: E5 → B5, a rising perfect fifth. The second note lands while the
   first is still ringing, so it reads as one gesture rather than two beeps. */
const success = mix(
  note(659.25, { duration: 0.75, decay: 5.5, amplitude: 0.5 }),
  note(987.77, { duration: 0.75, decay: 5.0, amplitude: 0.42, delay: 0.085 }),
);
```

with:

```js
/* Success: E5 → B5, a rising perfect fifth. The second note lands while the
   first is still ringing, so it reads as one gesture rather than two beeps.
   Decay is intentionally slower than the other two cues (and duration
   longer) so the resolving second note actually gets time to ring out —
   at the original 5.0-5.5/s decay the whole gesture was inaudible well
   before its buffer ended, which read as chopped rather than finished. */
const success = mix(
  note(659.25, { duration: 1.1, decay: 3.2, amplitude: 0.5 }),
  note(987.77, { duration: 1.1, decay: 2.8, amplitude: 0.42, delay: 0.085 }),
);
```

- [ ] **Step 4: Regenerate the wav files**

Run: `node scripts/generate-sounds.mjs`
Expected output: `Generated public/sounds/{success,delete,error}.wav`

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run scripts/generate-sounds.test.ts`
Expected: PASS — including the pre-existing "rings out to silence without clipping" tests (the tail-ramp guarantee is unchanged, only `duration`/`decay` moved) and the new duration test.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, trigger a success toast (e.g. save a settings change), and confirm by ear that the chime now audibly resolves — the second, higher note rings out — rather than stopping abruptly. `delete.wav`/`error.wav` should sound unchanged.

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-sounds.mjs scripts/generate-sounds.test.ts public/sounds/success.wav
git commit -m "fix(sound): let the success chime ring out instead of cutting off"
```

---

## Final step: push the migration to the live database

Tasks 1–8 leave `supabase/migrations/20260722160000_statement_fx_fallback.sql` written but **not applied** — this project's Supabase instance is the hosted one, not a local Docker stack, so applying it means writing to a real, currently-live database (per Global Constraints).

- [ ] **Confirm with the user, then run:** `npm run db:push` (applies the migration to the linked project)
- [ ] **Then regenerate real types:** `npm run db:types`, and diff the result against Task 1's hand-edit — they should match; if `supabase gen types` produces a different shape (e.g. different casing or nullability), reconcile in favor of the generated output.
- [ ] **Commit the regenerated `lib/supabase/types.ts`** if it differs from the hand-edited version.
