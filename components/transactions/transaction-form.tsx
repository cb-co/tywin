"use client";

import { useEffect, useTransition } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { TRANSACTION_TYPES, type TransactionType } from "@/lib/transactions/schema";
import { createTransaction, updateTransaction } from "@/app/(app)/transactions/actions";
import type { QuickAddData, TransactionWithRefs } from "@/lib/transactions/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { accountOptionLabel } from "@/lib/accounts/meta";
import { destinationAmount, invertRate } from "@/lib/transactions/money";
import { useUiSound } from "@/components/sound/sound-provider";

type FormValues = {
  type: TransactionType;
  account_id: string;
  to_account_id: string;
  category_id: string;
  amount: string;
  currency: string;
  /* Both rates are held the way they are DISPLAYED — units of the weaker
     currency per 1 unit of the stronger — and converted on submit. The base
     currency (usually USD) reads first so the number stays whole-ish. */
  /** Transaction-currency units per 1 base-currency unit. Stored inverted. */
  base_rate: string;
  /** Destination-currency units per 1 source-currency unit. Becomes to_amount. */
  transfer_rate: string;
  include_tax: boolean;
  include_commission: boolean;
  budget_only: boolean;
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
  const { accounts, categories, currencies, baseCurrency } = data;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("TransactionForm");
  const tType = useTranslations("TransactionTypes");
  const tc = useTranslations("Common");
  const isEdit = mode === "edit";
  const { playSuccess, playError } = useUiSound();

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
  // Label happens to equal the value today; declared anyway so enriching the
  // option text later cannot silently reintroduce a raw-value trigger.
  const currencyItems: Record<string, string> = Object.fromEntries(
    currencies.map((c) => [c.code, c.code]),
  );
  const categoryItems: Record<string, string> = {
    none: t("noCategory"),
    ...Object.fromEntries(
      categories.map((c) => [c.id, `${c.emoji ? `${c.emoji} ` : ""}${c.name}`]),
    ),
  };

  const firstAccount = accounts.find((a) => a.id === defaultAccountId) ?? accounts[0];

  const { register, handleSubmit, control, setValue, getValues } = useForm<FormValues>({
    defaultValues: transaction
      ? {
          type: transaction.type,
          account_id: transaction.account_id,
          to_account_id: transaction.to_account_id ?? "",
          category_id:
            transaction.category_id ?? (transaction.type === "payment" ? "none" : ""),
          amount: String(transaction.amount),
          currency: transaction.currency,
          base_rate: String(invertRate(transaction.exchange_rate)),
          transfer_rate: String(
            transaction.to_amount && transaction.amount
              ? transaction.to_amount / transaction.amount
              : 1,
          ),
          include_tax: transaction.include_tax,
          include_commission: transaction.include_commission,
          budget_only: transaction.budget_only,
          occurred_at: toDateOnly(transaction.occurred_at),
          description: transaction.description ?? "",
        }
      : {
          type: "expense",
          account_id: firstAccount?.id ?? "",
          to_account_id: "",
          category_id: categories[0]?.id ?? "",
          amount: "",
          currency: firstAccount?.currency ?? baseCurrency,
          base_rate: "1",
          transfer_rate: "1",
          include_tax: false,
          include_commission: !(firstAccount?.network_fee_optional ?? true),
          budget_only: false,
          occurred_at: todayLocal(),
          description: "",
        },
  });

  const type = (useWatch({ control, name: "type" }) ?? "expense") as TransactionType;
  const accountId = useWatch({ control, name: "account_id" }) ?? "";
  const toAccountId = useWatch({ control, name: "to_account_id" }) ?? "";
  const currency = useWatch({ control, name: "currency" }) ?? baseCurrency;
  const amountRaw = useWatch({ control, name: "amount" }) ?? "";
  const transferRateRaw = useWatch({ control, name: "transfer_rate" }) ?? "";

  const src = accounts.find((a) => a.id === accountId);
  const dst = accounts.find((a) => a.id === toAccountId);
  const rateLocked = currency === baseCurrency;
  /* A payment is denominated in the source account's currency and carries a
     second leg in the destination's. The currency picker is therefore locked
     for payments — letting it drift from the source account is what made a
     10,000 DOP transfer take 10,000 USD out of a USD account. */
  const currencyLocked = isEdit || type === "payment";
  const crossCurrency =
    type === "payment" && !!src && !!dst && src.currency !== dst.currency;
  const sameBankPayment =
    type === "payment" && !!src?.bank_id && !!dst?.bank_id && src.bank_id === dst.bank_id;

  /* What each side actually moves, shown under the rate. The old form gave no
     hint that the two legs were the same number in different currencies. */
  const landing =
    crossCurrency && Number(amountRaw) > 0 && Number(transferRateRaw) > 0
      ? destinationAmount(Number(amountRaw), Number(transferRateRaw))
      : null;

  // Currency follows the source account (create only — in edit it's immutable).
  // Switching type to payment re-asserts it, in case an expense left it elsewhere.
  useEffect(() => {
    if (isEdit || !src) return;
    setValue("currency", src.currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, type]);

  // Smart defaults: tax on for a payment into a loan; network fee on only for a
  // cross-bank obligatory transfer (same-bank transfers are free).
  useEffect(() => {
    if (isEdit || !src) return;
    setValue("include_tax", type === "payment" && dst?.type === "loan");
    setValue("include_commission", !sameBankPayment && !src.network_fee_optional);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, toAccountId, accountId]);

  // Income never carries a category; expense needs one.
  useEffect(() => {
    if (type === "income") setValue("category_id", "");
    else if (type === "expense" && !getValues("category_id"))
      setValue("category_id", categories[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // A base-currency transaction always has rate 1.
  useEffect(() => {
    if (rateLocked) setValue("base_rate", "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  // A same-currency payment moves the same number across, so its rate is 1.
  useEffect(() => {
    if (!crossCurrency) setValue("transfer_rate", "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crossCurrency]);

  function onSubmit(values: FormValues) {
    const isPayment = values.type === "payment";
    const baseRate = Number(values.base_rate);
    const transferRate = Number(values.transfer_rate);

    // Both rates are displayed strong-currency-first; the DB wants base per
    // unit of transaction currency, and an explicit destination-currency leg.
    if (!(baseRate > 0)) {
      toast.error(t("rateInvalid"));
      playError();
      return;
    }
    if (isPayment && crossCurrency && !(transferRate > 0)) {
      toast.error(t("transferRateInvalid"));
      playError();
      return;
    }

    startTransition(async () => {
      const payload = {
        ...values,
        exchange_rate: invertRate(baseRate),
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
                onClick={() => field.onChange(t)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  field.value === t
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tType(t)}
              </button>
            ))}
          </div>
        )}
      />

      {/* Amount + currency */}
      <div className="space-y-2">
        <Label htmlFor="amount">{t("amountLabel")}</Label>
        <div className="flex gap-2">
          <Input id="amount" type="number" step="0.01" min="0" placeholder={t("amountPlaceholder")} className="flex-1" {...register("amount")} required />
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={currencyLocked} items={currencyItems}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        {!rateLocked ? (
          <div className="flex items-center gap-2 pt-1">
            <Label htmlFor="base_rate" className="text-xs font-normal text-muted-foreground">
              {t("ratePrefix", { currency: baseCurrency })}
            </Label>
            <Input id="base_rate" type="number" step="0.00000001" min="0" className="h-8 w-32" disabled={isEdit} {...register("base_rate")} />
            <span className="text-xs text-muted-foreground">{currency}</span>
          </div>
        ) : null}
        {crossCurrency && src && dst ? (
          <div className="flex items-center gap-2 pt-1">
            <Label htmlFor="transfer_rate" className="text-xs font-normal text-muted-foreground">
              {t("ratePrefix", { currency: src.currency })}
            </Label>
            <Input id="transfer_rate" type="number" step="0.00000001" min="0" className="h-8 w-32" {...register("transfer_rate")} />
            <span className="text-xs text-muted-foreground">{dst.currency}</span>
          </div>
        ) : null}
        {landing !== null && dst ? (
          <p className="text-xs text-muted-foreground">
            {t("destinationLands", {
              amount: landing.toLocaleString(undefined, { maximumFractionDigits: 2 }),
              currency: dst.currency,
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
            <Select value={field.value} onValueChange={field.onChange} items={accountItems}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {accountOptionLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
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
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {accountOptionLabel(a)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      ) : null}

      {/* Category (expense + payment) */}
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
      {type !== "income" ? (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <Controller
            control={control}
            name="include_tax"
            render={({ field }) => (
              <ToggleRow
                id="include_tax"
                label={t("applyTaxLabel")}
                checked={field.value}
                onChange={field.onChange}
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
                disabled={sameBankPayment}
              />
            )}
          />
          {type === "expense" ? (
            <Controller
              control={control}
              name="budget_only"
              render={({ field }) => (
                <ToggleRow
                  id="budget_only"
                  label={t("budgetOnlyLabel")}
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
          <Input id="occurred_at" type="date" {...register("occurred_at")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">{t("descriptionLabel")}</Label>
          <Input id="description" placeholder={t("descriptionPlaceholder")} {...register("description")} />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
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
