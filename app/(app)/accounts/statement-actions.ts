"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/errors";
import { extractStatementText } from "@/lib/statements/extract";
import { detectParser } from "@/lib/statements/registry";
import { validateChecksums } from "@/lib/statements/validate";
import { centsToDecimal } from "@/lib/statements/money";
import { suggestAccountId, type CardAccountOption } from "@/lib/statements/mapping";
import { resolveCategoryId, type CategoryRuleRow } from "@/lib/statements/categorize";
import { getExchangeRates } from "@/lib/fx";
import type { ParsedStatement } from "@/lib/statements/types";

export interface SectionPreview {
  sectionKey: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  closingBalance: string;
  costOfCarry: string | null;
  lineCount: number;
  paymentCount: number;
  creditLimit: string | null;
  mappedAccountId: string | null;
  suggestedAccountId: string | null;
}
export interface StatementPreviewResult {
  error?: string;
  needsPassword?: boolean;
  preview?: {
    parserId: string;
    cardLast4: string | null;
    fileName: string;
    cardGroupId: string | null;
    needsMapping: boolean;
    sections: SectionPreview[];
    accountOptions: { id: string; name: string; currency: string }[];
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Shared by parse and confirm: extract → detect → parse → checksum. */
async function runPipeline(formData: FormData) {
  const t = await getTranslations("Statements");
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") } as const;

  const file = formData.get("file");
  const accountId = String(formData.get("account_id") ?? "");
  const password = String(formData.get("password") ?? "") || undefined;
  if (!(file instanceof File) || !accountId) return { error: t("invalidUpload") } as const;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extracted = await extractStatementText(bytes, password);
  if (!extracted.ok) {
    if (extracted.reason === "unreadable") return { error: t("unreadablePdf") } as const;
    return { needsPassword: true } as const;
  }

  const parser = detectParser(extracted.text);
  if (!parser) {
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: "unknown",
      file_name: file.name,
      status: "failed_detection",
      error: "no parser matched",
    });
    return { error: t("unsupportedBank") } as const;
  }

  let parsed: ParsedStatement;
  try {
    parsed = parser.parse(extracted.text);
  } catch (e) {
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: parser.id,
      file_name: file.name,
      status: "failed_detection",
      error: String(e),
    });
    return { error: t("parseFailed") } as const;
  }

  const failures = validateChecksums(parsed);
  if (failures.length) {
    const detail = failures
      .map((f) => `${f.sectionKey}: ${centsToDecimal(f.computedCents)} ≠ ${centsToDecimal(f.statedCents)}`)
      .join("; ");
    await supabase.from("statement_imports").insert({
      user_id: user.id,
      parser_id: parser.id,
      file_name: file.name,
      status: "failed_validation",
      error: detail,
    });
    return { error: t("checksumFailed", { detail }) } as const;
  }

  // Resolve the card group + account options from the account the user is on.
  const { data: account } = await supabase
    .from("accounts")
    .select("id,name,currency,credit_limit,card_group_id,type")
    .eq("id", accountId)
    .single();
  if (!account || account.type !== "credit_card") return { error: t("notACard") } as const;

  let options: CardAccountOption[] = [
    { id: account.id, name: account.name, currency: account.currency, credit_limit: account.credit_limit },
  ];
  if (account.card_group_id) {
    const { data: group } = await supabase
      .from("accounts")
      .select("id,name,currency,credit_limit")
      .eq("card_group_id", account.card_group_id)
      .eq("type", "credit_card")
      .eq("is_archived", false);
    if (group?.length) options = group;
  }

  const { data: savedRows } = await supabase
    .from("statement_section_mappings")
    .select("section_key,account_id")
    .eq("parser_id", parser.id)
    .eq("card_group_id", account.card_group_id ?? "00000000-0000-0000-0000-000000000000");
  const saved = new Map((savedRows ?? []).map((m) => [m.section_key, m.account_id]));

  return { supabase, user, file, bytes, parser, parsed, account, options, saved, t } as const;
}

export async function parseStatement(formData: FormData): Promise<StatementPreviewResult> {
  const ctx = await runPipeline(formData);
  if ("error" in ctx || "needsPassword" in ctx) return ctx as StatementPreviewResult;
  const { parsed, parser, account, options, saved, file } = ctx;

  const sections: SectionPreview[] = parsed.sections.map((s) => {
    const mapped =
      saved.get(s.sectionKey) ??
      (parsed.sections.length === 1 && options.length === 1 ? options[0].id : null);
    return {
      sectionKey: s.sectionKey,
      currency: s.currency,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      dueDate: s.dueDate,
      closingBalance: centsToDecimal(s.closingBalanceCents),
      costOfCarry: s.costOfCarryCents === null ? null : centsToDecimal(s.costOfCarryCents),
      lineCount: s.lines.filter((l) => l.kind !== "payment").length,
      paymentCount: s.lines.filter((l) => l.kind === "payment").length,
      creditLimit: s.creditLimitCents === null ? null : centsToDecimal(s.creditLimitCents),
      mappedAccountId: mapped,
      suggestedAccountId: mapped ?? suggestAccountId(s, options),
    };
  });

  return {
    preview: {
      parserId: parser.id,
      cardLast4: parsed.cardLast4,
      fileName: file.name,
      cardGroupId: account.card_group_id,
      needsMapping: sections.some((s) => !s.mappedAccountId),
      sections,
      accountOptions: options.map(({ id, name, currency }) => ({ id, name, currency })),
    },
  };
}

export async function confirmStatementImport(formData: FormData): Promise<{ error?: string }> {
  const ctx = await runPipeline(formData);
  if ("error" in ctx) return { error: ctx.error };
  if ("needsPassword" in ctx) return { error: (await getTranslations("Statements"))("passwordRequired") };
  const { supabase, user, parsed, parser, account, options, bytes, file, t } = ctx;

  let mappings: Record<string, string>;
  try {
    const raw: unknown = JSON.parse(String(formData.get("mappings") ?? "{}"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("not an object");
    mappings = Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>;
  } catch {
    return { error: t("invalidUpload") };
  }
  const optionById = new Map(options.map((o) => [o.id, o]));

  // Every section must land on a currency-matching card the user owns.
  for (const s of parsed.sections) {
    const target = mappings[s.sectionKey];
    const opt = target ? optionById.get(target) : undefined;
    if (!opt) return { error: t("unmappedSection", { section: s.sectionKey }) };
    if (opt.currency !== s.currency)
      return { error: t("currencyMismatch", { section: s.sectionKey, currency: s.currency }) };
  }

  // Category resolution inputs.
  const [{ data: cats }, { data: ruleRows }, { data: profile }] = await Promise.all([
    supabase.from("categories").select("id,name"),
    supabase.from("category_rules").select("rule_type,pattern,category_id,priority"),
    supabase.from("profiles").select("base_currency").maybeSingle(),
  ]);
  const categoryIdByName = new Map((cats ?? []).map((c) => [c.name, c.id]));
  const otherId = categoryIdByName.get("Other") ?? cats?.[0]?.id;
  if (!otherId) return { error: t("noCategories") };
  const rules = (ruleRows ?? []) as CategoryRuleRow[];
  const baseCurrency = profile?.base_currency ?? "USD";
  const rates = await getExchangeRates(baseCurrency);

  // Store the original file (still encrypted if it was) in the private bucket.
  const filePath = `${user.id}/${parsed.sections[0].periodEnd}-${parser.id}-${parsed.cardLast4 ?? "xxxx"}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("statements")
    .upload(filePath, bytes, { contentType: "application/pdf", upsert: true });
  // Upload failure is non-fatal: the import is the point; the file is a nicety.
  const storedPath = uploadError ? "" : filePath;

  const payload = {
    parser_id: parser.id,
    card_group_id: account.card_group_id ?? "",
    file_name: file.name,
    file_path: storedPath,
    sections: parsed.sections.map((s) => {
      const rate = s.currency === baseCurrency ? 1 : rates[s.currency] ? 1 / rates[s.currency] : 1;
      return {
        account_id: mappings[s.sectionKey],
        section_key: s.sectionKey,
        period_start: s.periodStart,
        period_end: s.periodEnd,
        due_date: s.dueDate ?? "",
        previous_balance: centsToDecimal(s.previousBalanceCents),
        total_debits: centsToDecimal(s.totalDebitsCents),
        total_credits: centsToDecimal(s.totalCreditsCents),
        statement_balance: centsToDecimal(s.balanceToPayCents),
        total_balance: centsToDecimal(s.closingBalanceCents),
        minimum_payment: s.minimumPaymentCents === null ? "" : centsToDecimal(s.minimumPaymentCents),
        overdue_amount: s.overdueAmountCents === null ? "" : centsToDecimal(s.overdueAmountCents),
        overdue_installments: s.overdueInstallments === null ? "" : String(s.overdueInstallments),
        credit_limit: s.creditLimitCents === null ? "" : centsToDecimal(s.creditLimitCents),
        available_credit: s.availableCreditCents === null ? "" : centsToDecimal(s.availableCreditCents),
        interest_rate_annual: s.interestRateAnnual === null ? "" : String(s.interestRateAnnual),
        avg_daily_balance: s.avgDailyBalanceCents === null ? "" : centsToDecimal(s.avgDailyBalanceCents),
        avg_daily_balance_prior:
          s.avgDailyBalancePriorCents === null ? "" : centsToDecimal(s.avgDailyBalancePriorCents),
        cost_of_carry: s.costOfCarryCents === null ? "" : centsToDecimal(s.costOfCarryCents),
        cost_of_carry_prior:
          s.costOfCarryPriorCents === null ? "" : centsToDecimal(s.costOfCarryPriorCents),
        exchange_rate: String(rate),
        lines: s.lines.map((l) => ({
          line_no: String(l.lineNo),
          made_on: l.madeOn,
          posted_on: l.postedOn,
          reference: l.reference ?? "",
          description: l.description,
          mcc: l.mcc ?? "",
          auth_code: l.authCode ?? "",
          amount: centsToDecimal(l.amountCents),
          kind: l.kind,
          category_id:
            l.kind === "payment" ? "" : resolveCategoryId(l, rules, categoryIdByName, otherId),
        })),
      };
    }),
  };

  const { error } = await supabase.rpc("import_card_statement", { p: payload });
  if (error) return { error: await dbError(error, "importCardStatement") };

  // Remember confirmed mappings for zero-touch future imports.
  if (account.card_group_id) {
    const cardGroupId = account.card_group_id;
    for (const s of parsed.sections) {
      await supabase.from("statement_section_mappings").upsert(
        {
          user_id: user.id,
          parser_id: parser.id,
          card_group_id: cardGroupId,
          section_key: s.sectionKey,
          account_id: mappings[s.sectionKey],
        },
        { onConflict: "user_id,parser_id,card_group_id,section_key" },
      );
    }
  }

  revalidatePath("/accounts");
  for (const id of new Set(parsed.sections.map((s) => mappings[s.sectionKey])))
    revalidatePath(`/accounts/${id}`);
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  revalidatePath("/insights");
  return {};
}

export async function deleteCardStatement(id: string, accountId: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") };
  const { error } = await supabase.from("card_statements").delete().eq("id", id);
  if (error) return { error: await dbError(error, "deleteCardStatement") };
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/");
  return {};
}

export async function saveMerchantRule(pattern: string, categoryId: string): Promise<{ error?: string }> {
  const trimmed = pattern.trim();
  if (!trimmed) return { error: "empty pattern" };
  const { supabase, user } = await requireUser();
  if (!user) return { error: (await getTranslations("Common"))("notSignedIn") };
  const { error } = await supabase.from("category_rules").upsert(
    { user_id: user.id, rule_type: "merchant", pattern: trimmed, category_id: categoryId, priority: 10 },
    { onConflict: "user_id,rule_type,pattern" },
  );
  if (error) return { error: await dbError(error, "saveMerchantRule") };
  return {};
}
