"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  BILLING_CYCLES,
  usesAnchorDate,
  type BillingCycle,
} from "@/lib/subscriptions/cycle";
import { SEMIMONTHLY_MAX_ANCHOR, semimonthlyStarts } from "@/lib/period/cycle";
import { subscriptionInput } from "@/lib/subscriptions/schema";
import { RECURRING_KINDS, templateAllowsFees, type RecurringKind } from "@/lib/subscriptions/template";
import { resolveFeeDefaults } from "@/lib/transactions/defaults";
import {
  createSubscription,
  resolveSubscriptionBrand,
  updateSubscription,
} from "@/app/(app)/recurring/actions";
import type { QuickAddAccount, QuickAddData } from "@/lib/transactions/queries";
import type { SubscriptionWithRefs } from "@/lib/subscriptions/queries";
import { useUiSound } from "@/components/sound/sound-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FieldError } from "@/components/ui/field-error";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCOUNT_GROUPS, accountOptionLabel, accountTypeMeta, type AccountType } from "@/lib/accounts/meta";
import { cn } from "@/lib/utils";

type Values = {
  kind: RecurringKind;
  name: string;
  amount: string;
  currency: string;
  billing_cycle: BillingCycle;
  anchor_day: string;
  anchor_date: string;
  account_id: string;
  to_account_id: string;
  category_id: string;
  include_tax: boolean;
  include_commission: boolean;
  is_active: boolean;
};

function defaults(sub: SubscriptionWithRefs | undefined, baseCurrency: string): Values {
  return {
    kind: (sub?.kind as RecurringKind) ?? "expense",
    name: sub?.name ?? "",
    amount: sub ? String(sub.amount) : "",
    currency: sub?.currency ?? baseCurrency,
    billing_cycle: (sub?.billing_cycle as BillingCycle) ?? "monthly",
    anchor_day: sub?.anchor_day ? String(sub.anchor_day) : "",
    anchor_date: sub?.anchor_date ?? "",
    account_id: sub?.account_id ?? "none",
    to_account_id: sub?.to_account_id ?? "none",
    category_id: sub?.category_id ?? "none",
    include_tax: sub?.include_tax ?? false,
    include_commission: sub?.include_commission ?? false,
    is_active: sub?.is_active ?? true,
  };
}

/** `subscriptionInput` validates the account and category ids as `z.string().uuid().optional().or(z.literal(""))`
 *  — it never accepts the literal `"none"` that these `Select`s default to when nothing is
 *  picked, and `anchor_day`'s `z.coerce.number().int().min(1)...optional()` coerces a blank `""`
 *  to `0` (not `undefined`) before the `min(1)` check runs, so a never-touched anchor day fails
 *  validation too. Both are legitimate default states the resolver would otherwise reject before
 *  the user has done anything wrong. Clean them here, right before validation, so the resolver
 *  only ever sees "none" and blank-anchor-day as what they mean: unset. */
function cleanForValidation(values: Values): Values {
  return {
    ...values,
    account_id: values.account_id === "none" ? "" : values.account_id,
    to_account_id: values.to_account_id === "none" ? "" : values.to_account_id,
    category_id: values.category_id === "none" ? "" : values.category_id,
    anchor_day: values.anchor_day === "" ? undefined : values.anchor_day,
  } as Values;
}

export function SubscriptionFormDialog({
  mode,
  subscription,
  data,
  trigger,
}: {
  mode: "create" | "edit";
  subscription?: SubscriptionWithRefs;
  data: QuickAddData;
  trigger: React.ReactNode;
}) {
  const { accounts, categories, currencies, baseCurrency } = data;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations("SubscriptionForm");
  const tType = useTranslations("TransactionTypes");
  const tCycle = useTranslations("BillingCycles");
  const tTxn = useTranslations("TransactionForm");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useUiSound();

  /* Value→label maps for the closed trigger. Base UI's `<Select.Value>`
     renders the raw value unless `items` is given on the root, which showed
     bare UUIDs and raw cycle keys. Sentinels ("none") need an entry too. */
  const cycleItems: Record<string, string> = Object.fromEntries(
    BILLING_CYCLES.map((c) => [c, tCycle(c)]),
  );
  // Label happens to equal the value today; declared anyway so enriching the
  // option text later cannot silently reintroduce a raw-value trigger.
  const currencyItems: Record<string, string> = Object.fromEntries(
    currencies.map((c) => [c.code, c.code]),
  );
  const accountItems: Record<string, string> = {
    none: tc("none"),
    ...Object.fromEntries(accounts.map((a) => [a.id, accountOptionLabel(a)])),
  };
  const categoryItems: Record<string, string> = {
    none: tc("none"),
    ...Object.fromEntries(
      categories.map((c) => [c.id, `${c.emoji ? `${c.emoji} ` : ""}${c.name}`]),
    ),
  };
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<Values>({
    // `subscriptionInput` coerces `amount` and `anchor_day` to numbers and cannot accept the
    // "none" sentinel these Selects default to (see `cleanForValidation`) — so validation runs
    // against cleaned values, and `{ raw: true }` hands `onSubmit` back the (cleaned) `Values`
    // shape it already expects instead of the schema's parsed/coerced output. `errors` still
    // populates from the same validation pass.
    resolver: ((values, context, options) =>
      zodResolver(subscriptionInput, undefined, { raw: true })(
        cleanForValidation(values),
        context,
        options as never,
      )) as Resolver<Values, unknown, Values>,
    defaultValues: defaults(subscription, baseCurrency),
  });

  const kind = useWatch({ control, name: "kind" });
  const cycle = useWatch({ control, name: "billing_cycle" });
  const anchorDay = Number(useWatch({ control, name: "anchor_day" }));
  const firstPaydayValid =
    Number.isInteger(anchorDay) && anchorDay >= 1 && anchorDay <= SEMIMONTHLY_MAX_ANCHOR;
  const accountId = useWatch({ control, name: "account_id" });
  const byId = (id: string) => accounts.find((a) => a.id === id) ?? null;
  const payment = kind === "payment";
  const income = kind === "income";
  // Bank debits only; a card or cash template records fee-free (see
  // lib/subscriptions/template), so the toggles would only mislead there.
  const showFees = templateAllowsFees(kind, byId(accountId)?.type);

  /* Where the fee toggles start, re-derived whenever what decides them changes —
     the same rule quick-add follows. Only on a person's own change, never on
     open: an edited template keeps whatever it was saved with. */
  function refreshFees(next: Partial<Pick<Values, "kind" | "account_id" | "to_account_id">>) {
    const v = { ...getValues(), ...next };
    const fees = resolveFeeDefaults({
      type: v.kind,
      src: byId(v.account_id),
      dst: v.kind === "payment" ? byId(v.to_account_id) : null,
    });
    setValue("include_tax", fees.include_tax);
    setValue("include_commission", fees.include_commission);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(defaults(subscription, baseCurrency));
  }

  function onSubmit(values: Values) {
    startTransition(async () => {
      const payload = {
        ...values,
        account_id: values.account_id === "none" ? "" : values.account_id,
        to_account_id: values.to_account_id === "none" ? "" : values.to_account_id,
        category_id: values.category_id === "none" ? "" : values.category_id,
        anchor_day: values.anchor_day === "" ? undefined : values.anchor_day,
      };
      const result =
        mode === "create"
          ? await createSubscription(payload)
          : await updateSubscription(subscription!.id, payload);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(mode === "create" ? t("toastAdded") : t("toastUpdated"));
      playSuccess();
      setOpen(false);
      router.refresh();

      /* The brand colour and logo are resolved AFTER the save, deliberately not
         awaited.
         The model answers in ~600ms warm but can take over a minute cold, and
         nobody should sit in front of a spinner for a guess — so the dialog is
         already closed and the payment already listed by the time this starts.
         It lands on its own and refreshes again; if the person navigates away
         first, the request dies and the next save simply tries again.

         `void` rather than `await` is load-bearing: awaiting it inside the
         transition would put the whole cold call back on the save's critical
         path, which is the bug this exists to avoid. */
      if (result.id)
        void resolveSubscriptionBrand(result.id).then(({ resolved }) => {
          if (resolved) router.refresh();
        });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {mode === "create" ? t("addTitle") : t("editTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="min-w-0 space-y-4">
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                {RECURRING_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={field.value === k}
                    onClick={() => {
                      field.onChange(k);
                      refreshFees({ kind: k });
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      field.value === k
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tType(k)}
                  </button>
                ))}
              </div>
            )}
          />

          {/* Income only, and a full-width row rather than a note under the
              amount field: "Amount" reads unambiguously on an expense — it is
              what the charge costs — but a salary has two honest answers, and
              the gross one is the number people know by heart. What the template
              records is a deposit, so it has to be the net, and that has to be
              said before the number is typed rather than after the balance comes
              out wrong. */}
          {income ? (
            <p className="text-xs text-muted-foreground">{t("amountHintIncome")}</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" required>{t("nameLabel")}</Label>
              <Input
                id="name"
                placeholder={
                  payment ? t("namePlaceholderPayment") : income ? t("namePlaceholderIncome") : t("namePlaceholder")
                }
                aria-invalid={!!errors.name}
                {...register("name")}
                required
              />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount" required>{t("amountLabel")}</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  className="min-w-0 flex-1"
                  aria-invalid={!!errors.amount}
                  {...register("amount")}
                  required
                />
                <Controller
                  control={control}
                  name="currency"
                  render={({ field, fieldState }) => (
                    <Select value={field.value} onValueChange={field.onChange} items={currencyItems}>
                      <SelectTrigger className="w-24" aria-invalid={!!fieldState.error}>
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
              <FieldError message={errors.amount?.message ?? errors.currency?.message} />
            </div>
            <div className="space-y-2">
              <Label required>{t("billingCycleLabel")}</Label>
              <Controller
                control={control}
                name="billing_cycle"
                render={({ field, fieldState }) => (
                  <Select value={field.value} onValueChange={field.onChange} items={cycleItems}>
                    <SelectTrigger className="w-full" aria-invalid={!!fieldState.error}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_CYCLES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {tCycle(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.billing_cycle?.message} />
            </div>
            {usesAnchorDate(cycle) ? (
              <div className="space-y-2">
                <Label htmlFor="anchor_date" required>{t("startDateLabel")}</Label>
                <Input
                  id="anchor_date"
                  type="date"
                  aria-invalid={!!errors.anchor_date}
                  aria-describedby="anchor_date_hint"
                  {...register("anchor_date")}
                  required
                />
                <p id="anchor_date_hint" className="text-xs text-muted-foreground">
                  {t("startDateHint")}
                </p>
                <FieldError message={errors.anchor_date?.message} />
              </div>
            ) : cycle === "semimonthly" ? (
              <div className="space-y-2">
                <Label htmlFor="anchor_day">{t("semimonthlyDayLabel")}</Label>
                <Input
                  id="anchor_day"
                  type="number"
                  min="1"
                  max={SEMIMONTHLY_MAX_ANCHOR}
                  placeholder="1"
                  aria-invalid={!!errors.anchor_day}
                  aria-describedby="anchor_day_hint"
                  {...register("anchor_day")}
                />
                <p id="anchor_day_hint" className="text-xs text-muted-foreground">
                  {firstPaydayValid
                    ? t("semimonthlyDayHint", { second: semimonthlyStarts(anchorDay)[1] })
                    : t("semimonthlyDayRange")}
                </p>
                <FieldError message={errors.anchor_day?.message} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="anchor_day">{t("chargeDayLabel")}</Label>
                <Input id="anchor_day" type="number" min="1" max="31" placeholder={t("chargeDayPlaceholder")} {...register("anchor_day")} />
              </div>
            )}
            <div className="space-y-2">
              {/* Required wherever the account is a DESTINATION — the account a
                  payment comes from, and the one income lands in. An expense's
                  "charged from" stays optional, the one case where a template is
                  still useful before you have decided where it is billed. */}
              <Label required={payment || income}>
                {payment ? t("fromAccountLabel") : income ? t("depositAccountLabel") : t("chargeAccountLabel")}
              </Label>
              <Controller
                control={control}
                name="account_id"
                render={({ field, fieldState }) => (
                  <AccountSelect
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      refreshFees({ account_id: v });
                    }}
                    accounts={accounts}
                    items={accountItems}
                    noneLabel={tc("none")}
                    invalid={!!fieldState.error}
                  />
                )}
              />
              <FieldError message={errors.account_id?.message} />
            </div>
            {/* Two independent questions, not a choice between them. These used
                to share one ternary, so a payment showed its destination INSTEAD
                of a category and could never carry one — while the same payment
                typed into quick-add could. A payment answers both: where the
                money goes, and what it counts as. */}
            {payment ? (
              <div className="space-y-2">
                <Label required>{t("toAccountLabel")}</Label>
                <Controller
                  control={control}
                  name="to_account_id"
                  render={({ field, fieldState }) => (
                    <AccountSelect
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v);
                        refreshFees({ to_account_id: v });
                      }}
                      // Paying an account into itself is not a payment.
                      accounts={accounts.filter((a) => a.id !== accountId)}
                      items={accountItems}
                      noneLabel={tc("none")}
                      invalid={!!fieldState.error}
                    />
                  )}
                />
                <FieldError message={errors.to_account_id?.message} />
              </div>
            ) : null}
            {income ? null : (
              <div className="space-y-2">
                {/* Optional on a payment, exactly as quick-add marks it — the
                    car loan transfer that is worth filing under Transport and
                    the one that is worth filing under nothing are both normal. */}
                <Label>
                  {t("categoryLabel")}
                  {payment ? tTxn("categoryOptionalSuffix") : ""}
                </Label>
                <Controller
                  control={control}
                  name="category_id"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} items={categoryItems}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{tc("none")}</SelectItem>
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
            )}
          </div>

          {showFees ? (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <Controller
                control={control}
                name="include_tax"
                render={({ field }) => (
                  <ToggleRow
                    id="include_tax"
                    label={tTxn("applyTaxLabel")}
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
                    label={tTxn("applyFeeLabel")}
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          ) : null}

          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <Label htmlFor="is_active" className="font-normal">
                  {t("activeLabel")}
                </Label>
                <Switch id="is_active" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending} isLoading={pending}>
              {pending ? tc("saving") : mode === "create" ? t("addButton") : t("saveChangesButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountSelect({
  value,
  onChange,
  accounts,
  items,
  noneLabel,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  accounts: QuickAddAccount[];
  items: Record<string, string>;
  noneLabel: string;
  invalid?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as string)} items={items}>
      <SelectTrigger className="w-full" aria-invalid={invalid}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{noneLabel}</SelectItem>
        {ACCOUNT_GROUPS.map((g) => {
          const groupItems = accounts.filter(
            (a) => accountTypeMeta(a.type as AccountType).group === g.key,
          );
          if (groupItems.length === 0) return null;
          return (
            <SelectGroup key={g.key}>
              <SelectLabel>{g.title}</SelectLabel>
              {groupItems.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {accountOptionLabel(a)}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
