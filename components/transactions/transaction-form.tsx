"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { TRANSACTION_TYPES, type TransactionType } from "@/lib/transactions/schema";
import { createTransaction, updateTransaction } from "@/app/(app)/transactions/actions";
import { saveMerchantRule } from "@/app/(app)/accounts/statement-actions";
import type { QuickAddData, TransactionWithRefs } from "@/lib/transactions/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCOUNT_GROUPS,
  accountOptionLabel,
  accountTypeMeta,
  isBankAccount,
  type AccountType,
} from "@/lib/accounts/meta";
import { destinationAmount } from "@/lib/transactions/money";
import { crossRate } from "@/lib/fx";
import { formatMoney } from "@/lib/format";
import { useUiSound } from "@/components/sound/sound-provider";

type FormValues = {
  type: TransactionType;
  account_id: string;
  to_account_id: string;
  category_id: string;
  amount: string;
  /* No currency field. A transaction is denominated in its account's currency —
     the bank settles in what the account holds, whatever the merchant billed —
     so the server reads it off the account and the form only displays it. */
  /* The only rate a person is ever asked for, and only when a payment actually
     crosses currencies. The rate that converts this row into the base currency
     for budgets and net worth is derived server-side from the FX service — no
     money changed hands at that rate, so it is not the user's to supply.

     Destination-currency units per 1 source-currency unit. Becomes to_amount. */
  transfer_rate: string;
  include_tax: boolean;
  include_commission: boolean;
  exclude_from_budget: boolean;
  occurred_at: string;
  description: string;
};

/* occurred_at carries no meaningful time-of-day: the server stores whatever
   calendar date the user picks as UTC midnight of that date (see actions.ts),
   so it round-trips as the same Y-M-D no matter the viewer's timezone. Reading
   it back must extract that date via UTC, not local time — local time would
   read UTC midnight as "yesterday" for anyone west of UTC. */

/** Default for a new transaction: today, per the browser's wall clock. */
function todayLocal() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** Existing transaction: the date it was saved with, read back timezone-invariant. */
function toDateOnly(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

/** Groups accounts into the same 4 sections (cash/cards/loans/assets) as the
 *  Accounts page, so a long account list isn't one undifferentiated block. */
function groupedAccountOptions(list: QuickAddData["accounts"]) {
  return ACCOUNT_GROUPS.map((g) => {
    const items = list.filter((a) => accountTypeMeta(a.type as AccountType).group === g.key);
    if (items.length === 0) return null;
    return (
      <SelectGroup key={g.key}>
        <SelectLabel>{g.title}</SelectLabel>
        {items.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {accountOptionLabel(a)}
          </SelectItem>
        ))}
      </SelectGroup>
    );
  });
}

export function TransactionForm({
  data,
  mode = "create",
  transaction,
  defaultAccountId,
  onSuccess,
}: {
  data: QuickAddData;
  mode?: "create" | "edit";
  transaction?: TransactionWithRefs;
  defaultAccountId?: string;
  onSuccess?: () => void;
}) {
  const { accounts, categories, baseCurrency, rates } = data;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("TransactionForm");
  const tType = useTranslations("TransactionTypes");
  const tc = useTranslations("Common");
  const isEdit = mode === "edit";
  const { playSuccess, playError } = useUiSound();
  const fromStatement = isEdit && !!transaction?.statement_line_id;
  const [alwaysRule, setAlwaysRule] = useState(false);

  const SOURCE_LABEL: Record<TransactionType, string> = {
    expense: t("sourceLabelExpense"),
    income: t("sourceLabelIncome"),
    payment: t("sourceLabelPayment"),
  };

  /* Value→label maps for the closed trigger. Base UI's `<Select.Value>`
     renders the raw value unless `items` is given on the root, which showed
     bare UUIDs here. Sentinel options ("none") need an entry too. */
  const accountItems: Record<string, string> = Object.fromEntries(
    accounts.map((a) => [a.id, accountOptionLabel(a)]),
  );
  const categoryItems: Record<string, string> = {
    none: t("noCategory"),
    ...Object.fromEntries(
      categories.map((c) => [c.id, `${c.emoji ? `${c.emoji} ` : ""}${c.name}`]),
    ),
  };

  // Falling back to accounts[0] would pick whatever the query happened to
  // return first — a card or loan is a bad default source for a new expense.
  // A checking/savings account is the one people actually pay out of.
  const firstAccount =
    accounts.find((a) => a.id === defaultAccountId) ??
    accounts.find((a) => isBankAccount(a.type as AccountType)) ??
    accounts[0];

  const { register, handleSubmit, control, setValue, getValues } = useForm<FormValues>({
    defaultValues: transaction
      ? {
          type: transaction.type,
          account_id: transaction.account_id,
          to_account_id: transaction.to_account_id ?? "",
          category_id:
            transaction.category_id ?? (transaction.type === "payment" ? "none" : ""),
          amount: String(transaction.amount),
          transfer_rate:
            transaction.to_amount && transaction.amount
              ? String(transaction.to_amount / transaction.amount)
              : "",
          include_tax: transaction.include_tax,
          include_commission: transaction.include_commission,
          exclude_from_budget: transaction.exclude_from_budget,
          occurred_at: toDateOnly(transaction.occurred_at),
          description: transaction.description ?? "",
        }
      : {
          type: "expense",
          account_id: firstAccount?.id ?? "",
          to_account_id: "",
          category_id: categories[0]?.id ?? "",
          amount: "",
          transfer_rate: "",
          include_tax: false,
          include_commission: !(firstAccount?.network_fee_optional ?? true),
          exclude_from_budget: false,
          occurred_at: todayLocal(),
          description: "",
        },
  });

  const type = (useWatch({ control, name: "type" }) ?? "expense") as TransactionType;
  const accountId = useWatch({ control, name: "account_id" }) ?? "";
  const toAccountId = useWatch({ control, name: "to_account_id" }) ?? "";
  const amountRaw = useWatch({ control, name: "amount" }) ?? "";
  const transferRateRaw = useWatch({ control, name: "transfer_rate" }) ?? "";

  const src = accounts.find((a) => a.id === accountId);
  const dst = accounts.find((a) => a.id === toAccountId);
  /* The currency the amount is typed in: the source account's, for every type.
     Shown, never chosen. The bank settles in what the account holds, and
     `account_balances` applies `amount` to that account raw — so a row
     denominated in anything else silently corrupts the balance (a 10,000 DOP
     transfer taking 10,000 USD out of a USD account was this bug).

     On edit the stored currency wins: it is immutable in the DB, and a row
     written before this rule may not match its account. */
  const displayCurrency = (isEdit ? transaction?.currency : src?.currency) ?? baseCurrency;

  /* Which accounts an edit may move the row to. Currency is immutable, so only
     same-currency accounts are reachable — offering the rest would just earn a
     server rejection. The account currently on the row is always included, or a
     legacy row whose currency never matched its account would find its own
     account missing from the list. Create mode is unrestricted: the currency
     follows whatever is picked. */
  const selectableAccounts = isEdit
    ? accounts.filter((a) => a.currency === displayCurrency || a.id === accountId)
    : accounts;

  const crossCurrency =
    type === "payment" && !!src && !!dst && src.currency !== dst.currency;
  const sameBankPayment =
    type === "payment" && !!src?.bank_id && !!dst?.bank_id && src.bank_id === dst.bank_id;
  // Transfer tax and network fee model money leaving a bank account via
  // wire/ACH — meaningless from a card, cash, loan, or investment origin.
  const srcIsBankAccount = src?.type === "checking" || src?.type === "savings";

  /* A starting point for the required rate, one tap away. Offered rather than
     prefilled: the market rate is a good guess, but the user's actual rate is
     the fact we want, and a filled field stops people from checking it. */
  const marketRate =
    crossCurrency && src && dst ? crossRate(src.currency, dst.currency, rates) : null;

  /* What each side actually moves, shown under the rate. The old form gave no
     hint that the two legs were the same number in different currencies. */
  const landing =
    crossCurrency && Number(amountRaw) > 0 && Number(transferRateRaw) > 0
      ? destinationAmount(Number(amountRaw), Number(transferRateRaw))
      : null;

  // Smart defaults: tax on for a payment into a loan; network fee on only for a
  // cross-bank obligatory transfer (same-bank transfers are free).
  useEffect(() => {
    if (isEdit || !src) return;
    setValue("include_tax", type === "payment" && dst?.type === "loan");
    setValue("include_commission", !sameBankPayment && !src.network_fee_optional);
    setValue("exclude_from_budget", type === "expense" && src.type === "credit_card");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, toAccountId, accountId]);

  // Income never carries a category; expense needs one; a payment starts
  // uncategorized rather than silently inheriting whatever was picked
  // before switching type.
  useEffect(() => {
    if (type === "income") setValue("category_id", "");
    else if (type === "expense" && !getValues("category_id"))
      setValue("category_id", categories[0]?.id ?? "");
    else if (type === "payment" && !isEdit) setValue("category_id", "none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  /* Clear the rate whenever the currency PAIR changes, not merely when it
     stops crossing currencies — swapping the destination from a USD account to
     a EUR one otherwise silently reuses the rate typed for dollars. The ref
     seed means mount is not a change, so an edit's saved rate survives. */
  const pairKey = crossCurrency && src && dst ? `${src.currency}>${dst.currency}` : "";
  const prevPairKey = useRef(pairKey);
  useEffect(() => {
    if (prevPairKey.current === pairKey) return;
    prevPairKey.current = pairKey;
    setValue("transfer_rate", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKey]);

  function onSubmit(values: FormValues) {
    const isPayment = values.type === "payment";
    const transferRate = Number(values.transfer_rate);

    /* Required, with no default. The old default of 1 was the dangerous case:
       a 100 USD transfer into a DOP account silently landed 100 DOP. */
    if (isPayment && crossCurrency && !(transferRate > 0)) {
      toast.error(t("transferRateInvalid"));
      playError();
      return;
    }

    startTransition(async () => {
      const payload = {
        ...values,
        to_amount:
          isPayment && crossCurrency
            ? destinationAmount(Number(values.amount), transferRate)
            : undefined,
        to_account_id: isPayment ? values.to_account_id : "",
        category_id: values.type === "income" || values.category_id === "none" ? "" : values.category_id,
      };
      const result =
        isEdit && transaction
          ? await updateTransaction(transaction.id, payload)
          : await createTransaction(payload);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      if (fromStatement && alwaysRule && values.category_id && values.category_id !== "none") {
        await saveMerchantRule(transaction!.description ?? "", values.category_id);
      }
      toast.success(isEdit ? t("toastUpdated") : t("toastSaved"));
      playSuccess();
      onSuccess?.();
      router.refresh();
    });
  }

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("noAccountsHint")}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Type segmented control */}
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {TRANSACTION_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                disabled={fromStatement}
                onClick={() => field.onChange(t)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  field.value === t
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  fromStatement && "cursor-not-allowed opacity-60",
                )}
              >
                {tType(t)}
              </button>
            ))}
          </div>
        )}
      />

      {/* Amount, in the account's currency — displayed, not selectable */}
      <div className="space-y-2">
        <Label htmlFor="amount">{t("amountLabel")}</Label>
        <div className="relative">
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder={t("amountPlaceholder")}
            className="pr-16"
            aria-describedby="amount_currency"
            {...register("amount")}
            required
            disabled={fromStatement}
          />
          {/* Not aria-hidden: which currency the figure is in is the one thing a
              screen-reader user most needs here, now that nothing announces it. */}
          <span
            id="amount_currency"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
          >
            {displayCurrency}
          </span>
        </div>
        {/* The one rate a person is asked for: a payment that genuinely crosses
            currencies, where only they know what the money actually became. */}
        {crossCurrency && src && dst ? (
          <div className="space-y-1 pt-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="transfer_rate" className="text-xs font-normal text-muted-foreground">
                {t("ratePrefix", { currency: src.currency })}
              </Label>
              <Input
                id="transfer_rate"
                type="number"
                step="0.00000001"
                min="0"
                className="h-8 w-32"
                placeholder={t("ratePlaceholder")}
                required
                {...register("transfer_rate")}
              />
              <span className="text-xs text-muted-foreground">{dst.currency}</span>
            </div>
            {marketRate ? (
              <button
                type="button"
                /* 8dp is what numeric(18,8) keeps; rounding a DOP-per-USD rate
                   to 4dp instead would move real money on a large transfer.
                   Number() then drops the trailing zeros on a whole rate. */
                onClick={() => setValue("transfer_rate", String(Number(marketRate.toFixed(8))))}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                {t("useMarketRate", {
                  /* Significant digits, not decimals: 60.0002 and 0.0166667 are
                     both readable, where 4dp would show the latter as 0.0167. */
                  rate: marketRate.toLocaleString(undefined, { maximumSignificantDigits: 6 }),
                })}
              </button>
            ) : null}
          </div>
        ) : null}
        {landing !== null && dst ? (
          <p className="text-xs text-muted-foreground">
            {t("destinationLands", {
              amount: formatMoney(landing, dst.currency),
              account: dst.name,
            })}
          </p>
        ) : null}
      </div>

      {/* Source account */}
      <div className="space-y-2">
        <Label>{SOURCE_LABEL[type]}</Label>
        <Controller
          control={control}
          name="account_id"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={fromStatement} items={accountItems}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>{groupedAccountOptions(selectableAccounts)}</SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Destination (payment only) */}
      {type === "payment" ? (
        <div className="space-y-2">
          <Label>{t("toLabel")}</Label>
          <Controller
            control={control}
            name="to_account_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} items={accountItems}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("toPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {groupedAccountOptions(accounts.filter((a) => a.id !== accountId))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      ) : null}

      {/* Category (expense + payment; income has none) */}
      {type !== "income" ? (
        <div className="space-y-2">
          <Label>
            {t("categoryLabel")}
            {type === "payment" ? t("categoryOptionalSuffix") : ""}
          </Label>
          <Controller
            control={control}
            name="category_id"
            render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={field.onChange} items={categoryItems}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {type === "payment" ? <SelectItem value="none">{t("noCategory")}</SelectItem> : null}
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ` : ""}
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      ) : null}

      {/* Fee toggles */}
      {type !== "income" && (srcIsBankAccount || type === "expense") ? (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          {srcIsBankAccount ? (
            <>
              <Controller
                control={control}
                name="include_tax"
                render={({ field }) => (
                  <ToggleRow
                    id="include_tax"
                    label={t("applyTaxLabel")}
                    checked={field.value}
                    onChange={field.onChange}
                    disabled={fromStatement}
                  />
                )}
              />
              <Controller
                control={control}
                name="include_commission"
                render={({ field }) => (
                  <ToggleRow
                    id="include_commission"
                    label={t("applyFeeLabel")}
                    hint={sameBankPayment ? t("freeSameBankHint") : undefined}
                    checked={field.value && !sameBankPayment}
                    onChange={field.onChange}
                    disabled={sameBankPayment || fromStatement}
                  />
                )}
              />
            </>
          ) : null}
          {type === "expense" ? (
            <Controller
              control={control}
              name="exclude_from_budget"
              render={({ field }) => (
                <ToggleRow
                  id="exclude_from_budget"
                  label={t("excludeFromBudgetLabel")}
                  hint={t("excludeFromBudgetHint")}
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          ) : null}
        </div>
      ) : null}

      {/* Date + description */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="occurred_at">{t("dateLabel")}</Label>
          <Input id="occurred_at" type="date" {...register("occurred_at")} disabled={fromStatement} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">{t("descriptionLabel")}</Label>
          <Input
            id="description"
            placeholder={t("descriptionPlaceholder")}
            {...register("description")}
            disabled={fromStatement}
          />
        </div>
      </div>

      {fromStatement ? (
        <>
          <p className="text-xs text-muted-foreground">{t("fromStatementHint")}</p>
          <ToggleRow
            id="always_rule"
            label={t("alwaysCategorizeMerchant", { merchant: transaction!.description ?? "" })}
            checked={alwaysRule}
            onChange={setAlwaysRule}
          />
        </>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending} isLoading={pending}>
        {pending ? tc("saving") : isEdit ? t("saveChangesButton") : t("saveButton")}
      </Button>
    </form>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="font-normal text-muted-foreground">
        {label}
        {hint ? <span className="ml-1.5 text-xs text-success">{hint}</span> : null}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
