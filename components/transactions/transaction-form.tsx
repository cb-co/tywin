"use client";

import { useEffect, useTransition } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

type FormValues = {
  type: TransactionType;
  account_id: string;
  to_account_id: string;
  category_id: string;
  amount: string;
  currency: string;
  exchange_rate: string;
  include_tax: boolean;
  include_commission: boolean;
  budget_only: boolean;
  occurred_at: string;
  description: string;
};

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  payment: "Payment",
};

const SOURCE_LABEL: Record<TransactionType, string> = {
  expense: "Paid from",
  income: "Received into",
  payment: "From",
};

function nowLocal() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function toLocal(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
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
  const isEdit = mode === "edit";

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
          exchange_rate: String(transaction.exchange_rate),
          include_tax: transaction.include_tax,
          include_commission: transaction.include_commission,
          budget_only: transaction.budget_only,
          occurred_at: toLocal(transaction.occurred_at),
          description: transaction.description ?? "",
        }
      : {
          type: "expense",
          account_id: firstAccount?.id ?? "",
          to_account_id: "",
          category_id: categories[0]?.id ?? "",
          amount: "",
          currency: firstAccount?.currency ?? baseCurrency,
          exchange_rate: "1",
          include_tax: false,
          include_commission: !(firstAccount?.network_fee_optional ?? true),
          budget_only: false,
          occurred_at: nowLocal(),
          description: "",
        },
  });

  const type = (useWatch({ control, name: "type" }) ?? "expense") as TransactionType;
  const accountId = useWatch({ control, name: "account_id" }) ?? "";
  const toAccountId = useWatch({ control, name: "to_account_id" }) ?? "";
  const currency = useWatch({ control, name: "currency" }) ?? baseCurrency;

  const src = accounts.find((a) => a.id === accountId);
  const dst = accounts.find((a) => a.id === toAccountId);
  const rateLocked = currency === baseCurrency;
  const sameBankPayment =
    type === "payment" &&
    !!src?.bank &&
    !!dst?.bank &&
    src.bank.trim().toLowerCase() === dst.bank.trim().toLowerCase();

  // Currency follows the source account (create only — in edit it's immutable).
  useEffect(() => {
    if (isEdit || !src) return;
    setValue("currency", src.currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

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
    if (rateLocked) setValue("exchange_rate", "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const payload = {
        ...values,
        to_account_id: values.type === "payment" ? values.to_account_id : "",
        category_id: values.type === "income" || values.category_id === "none" ? "" : values.category_id,
      };
      const result =
        isEdit && transaction
          ? await updateTransaction(transaction.id, payload)
          : await createTransaction(payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Transaction updated" : "Transaction saved");
      onSuccess?.();
      router.refresh();
    });
  }

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add an account first — transactions need somewhere to land.
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
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      />

      {/* Amount + currency */}
      <div className="space-y-2">
        <Label htmlFor="amount">Amount</Label>
        <div className="flex gap-2">
          <Input id="amount" type="number" step="0.01" min="0" placeholder="0.00" className="flex-1" {...register("amount")} required />
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
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
            <Label htmlFor="exchange_rate" className="text-xs font-normal text-muted-foreground">
              1 {currency} =
            </Label>
            <Input id="exchange_rate" type="number" step="0.00000001" min="0" className="h-8 w-32" disabled={isEdit} {...register("exchange_rate")} />
            <span className="text-xs text-muted-foreground">{baseCurrency}</span>
          </div>
        ) : null}
      </div>

      {/* Source account */}
      <div className="space-y-2">
        <Label>{SOURCE_LABEL[type]}</Label>
        <Controller
          control={control}
          name="account_id"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} · {a.currency}
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
          <Label>To</Label>
          <Controller
            control={control}
            name="to_account_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose destination" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.currency}
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
          <Label>Category{type === "payment" ? " (optional)" : ""}</Label>
          <Controller
            control={control}
            name="category_id"
            render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {type === "payment" ? <SelectItem value="none">No category</SelectItem> : null}
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
                label="Apply transfer tax"
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
                label="Apply network fee"
                hint={sameBankPayment ? "Free within the same bank" : undefined}
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
                  label="Budget only (don't affect balance)"
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
          <Label htmlFor="occurred_at">Date</Label>
          <Input id="occurred_at" type="datetime-local" {...register("occurred_at")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" placeholder="Optional note" {...register("description")} />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : isEdit ? "Save changes" : "Save transaction"}
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
