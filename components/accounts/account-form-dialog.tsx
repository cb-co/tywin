"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { accountInput } from "@/lib/accounts/schema";
import {
  isCard,
  isLoan,
  hasTransferFees,
  type AccountType,
} from "@/lib/accounts/meta";
import {
  createAccount,
  updateAccount,
  createCardGroup,
  createBank,
} from "@/app/(app)/accounts/actions";
import type {
  AccountWithStatus,
  CurrencyRow,
  CardGroupRow,
  BankRow,
  CardGroupSibling,
} from "@/lib/accounts/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FormValues = {
  name: string;
  type: AccountType;
  currency: string;
  bank_id: string;
  starting_balance: string;
  transfer_tax_rate: string;
  network_fee_amount: string;
  network_fee_optional: boolean;
  credit_limit: string;
  last4: string;
  statement_closing_day: string;
  payment_due_day: string;
  current_balance: string;
  card_group_id: string;
  welcome_bonus_goal_amount: string;
  welcome_bonus_goal_currency: string;
  welcome_bonus_due_date: string;
  has_welcome_bonus_goal: boolean;
  principal: string;
  interest_rate: string;
  term_months: string;
  original_term_months: string;
  start_date: string;
  installment_amount: string;
};

const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** Every "" becomes undefined — mirrors what `accountInput`'s superRefine checks for
 *  conditionally-required numeric fields (see Task 4 note). Used both to validate on the
 *  client (via the resolver below) and to build the actual submit payload, so the two never
 *  disagree about what counts as "filled in". */
function blankToUndefined<T extends Record<string, unknown>>(values: T): T {
  return Object.fromEntries(
    Object.entries(values).map(([k, v]) => [k, v === "" ? undefined : v]),
  ) as T;
}

function defaultsFor(
  account: AccountWithStatus | undefined,
  baseCurrency: string,
  effectiveBonus: CardGroupSibling | null | undefined,
  initialType: AccountType | undefined,
): FormValues {
  const bonus =
    effectiveBonus ??
    (account
      ? {
          welcome_bonus_goal_amount: account.welcome_bonus_goal_amount,
          welcome_bonus_goal_currency: account.welcome_bonus_goal_currency,
          welcome_bonus_due_date: account.welcome_bonus_due_date,
        }
      : null);
  return {
    name: account?.name ?? "",
    type: (account?.type as AccountType) ?? initialType ?? "checking",
    currency: account?.currency ?? baseCurrency,
    bank_id: account?.bank_id ?? "none",
    starting_balance: str(account?.starting_balance) || "0",
    transfer_tax_rate: str(account?.transfer_tax_rate) || "0.002",
    network_fee_amount: str(account?.network_fee_amount) || "0",
    network_fee_optional: account?.network_fee_optional ?? true,
    credit_limit: str(account?.credit_limit),
    last4: account?.last4 ?? "",
    statement_closing_day: str(account?.statement_closing_day),
    payment_due_day: str(account?.payment_due_day),
    current_balance: str(account?.current_balance) || "0",
    card_group_id: account?.card_group_id ?? "none",
    welcome_bonus_goal_amount: str(bonus?.welcome_bonus_goal_amount),
    welcome_bonus_goal_currency: bonus?.welcome_bonus_goal_currency ?? baseCurrency,
    welcome_bonus_due_date: bonus?.welcome_bonus_due_date ?? "",
    has_welcome_bonus_goal: bonus?.welcome_bonus_goal_amount != null,
    principal: str(account?.principal),
    interest_rate: str(account?.interest_rate),
    term_months: str(account?.term_months),
    original_term_months: str(account?.original_term_months),
    start_date: account?.start_date ?? "",
    installment_amount: str(account?.installment_amount),
  };
}

export function AccountFormDialog({
  mode,
  account,
  currencies,
  cardGroups,
  banks,
  baseCurrency = "USD",
  effectiveBonus,
  trigger,
  initialType,
  open: controlledOpen,
  onOpenChange: onOpenChangeProp,
}: {
  mode: "create" | "edit";
  account?: AccountWithStatus;
  currencies: CurrencyRow[];
  cardGroups: CardGroupRow[];
  banks: BankRow[];
  baseCurrency?: string;
  effectiveBonus?: CardGroupSibling | null;
  /** Omit to run in controlled mode via `open`/`onOpenChange` instead (the create flow's
   *  type-picker select opens this dialog itself — see AccountGallery). */
  trigger?: React.ReactNode;
  /** Seeds `type` on create. Never user-editable inside the dialog — see spec §2. */
  initialType?: AccountType;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = trigger ? internalOpen : (controlledOpen ?? false);
  const setOpen = trigger ? setInternalOpen : (next: boolean) => onOpenChangeProp?.(next);
  const [pending, startTransition] = useTransition();
  const [newGroupName, setNewGroupName] = useState("");
  const [newBankName, setNewBankName] = useState("");
  const router = useRouter();
  const t = useTranslations("AccountForm");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useUiSound();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    // `{ raw: true }` matters here: without it, zodResolver hands `handleSubmit`'s valid
    // callback the *parsed* schema output (coerced numbers, `has_welcome_bonus_goal` stripped
    // since it isn't part of `accountInput`) instead of the form's own values, which would
    // silently corrupt `onSubmit`'s welcome-bonus-toggle logic. `raw: true` keeps the resolver
    // to its one job — running `accountInput` against the blank-cleaned values to populate
    // `errors` — and leaves `onSubmit` operating on the real `FormValues` shape.
    resolver: ((values, context, options) =>
      zodResolver(accountInput, undefined, { raw: true })(
        blankToUndefined(values) as FormValues,
        context,
        options as never,
      )) as Resolver<FormValues, unknown, FormValues>,
    defaultValues: defaultsFor(account, baseCurrency, effectiveBonus, initialType),
  });

  const type = (useWatch({ control, name: "type" }) ?? "checking") as AccountType;
  const groupSel = useWatch({ control, name: "card_group_id" }) ?? "none";
  const bankSel = useWatch({ control, name: "bank_id" }) ?? "none";
  const hasBonusGoal = useWatch({ control, name: "has_welcome_bonus_goal" }) ?? false;
  const card = isCard(type);
  const loan = isLoan(type);

  /* Value→label maps for the closed trigger. Base UI's `<Select.Value>`
     renders the raw value unless `items` is given on the root. Sentinel
     options ("none", "new") need an entry too. */
  const bankItems: Record<string, string> = {
    none: t("noBank"),
    new: t("newBank"),
    ...Object.fromEntries(banks.map((b) => [b.id, b.name])),
  };
  const groupItems: Record<string, string> = {
    none: t("noGroup"),
    new: t("newGroup"),
    ...Object.fromEntries(cardGroups.map((g) => [g.id, g.name])),
  };
  const currencyItems: Record<string, string> = Object.fromEntries(
    currencies.map((c) => [c.code, `${c.code} · ${c.name}`]),
  );

  // Runs on every open, however it happened — a trigger click (uncontrolled) or the parent
  // flipping `open` itself (controlled create flow). Resetting only inside the old
  // trigger-click handler missed the controlled path entirely.
  useEffect(() => {
    if (!open) return;
    reset(defaultsFor(account, baseCurrency, effectiveBonus, initialType));
    // Resetting local "new bank/group name" inputs alongside the form on every
    // open, not a derived-state cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNewGroupName("");
    setNewBankName("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      let cardGroupId = values.card_group_id;
      if (values.type === "credit_card" && cardGroupId === "new") {
        if (!newGroupName.trim()) {
          toast.error(t("toastNameGroupOrNone"));
          playError();
          return;
        }
        const created = await createCardGroup(newGroupName.trim());
        if (created.error) {
          toast.error(created.error);
          playError();
          return;
        }
        cardGroupId = created.id!;
      }
      const normalizedGroup = cardGroupId === "none" || cardGroupId === "new" ? "" : cardGroupId;

      let bankId = values.bank_id;
      if (bankId === "new") {
        if (!newBankName.trim()) {
          toast.error(t("toastNameBankOrNone"));
          playError();
          return;
        }
        const created = await createBank(newBankName.trim());
        if (created.error) {
          toast.error(created.error);
          playError();
          return;
        }
        bankId = created.id!;
      }
      const normalizedBank = bankId === "none" || bankId === "new" ? "" : bankId;

      const bonusValues = values.has_welcome_bonus_goal
        ? values
        : { ...values, welcome_bonus_goal_amount: "", welcome_bonus_goal_currency: "", welcome_bonus_due_date: "" };

      const clean = blankToUndefined({
        ...bonusValues,
        card_group_id: normalizedGroup,
        bank_id: normalizedBank,
      });

      const result =
        mode === "create"
          ? await createAccount(clean as never)
          : await updateAccount(account!.id, clean as never);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(mode === "create" ? t("toastAccountAdded") : t("toastAccountUpdated"));
      playSuccess();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger render={trigger as React.ReactElement} /> : null}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {mode === "create" ? t("addTitle") : t("editTitle")}
          </DialogTitle>
          <DialogDescription>
            {card
              ? t("descriptionCard")
              : loan
                ? t("descriptionLoan")
                : t("descriptionOther")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name" required>{t("nameLabel")}</Label>
              <Input
                id="name"
                placeholder={t("namePlaceholder")}
                aria-invalid={!!errors.name}
                {...register("name")}
                required
              />
              <FieldError message={errors.name?.message} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>{t("bankLabel")}</Label>
              <Controller
                control={control}
                name="bank_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} items={bankItems}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("noBank")}</SelectItem>
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">{t("newBank")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {bankSel === "new" ? (
                <Input
                  placeholder={t("bankNamePlaceholder")}
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                />
              ) : null}
              <p className="text-xs text-muted-foreground">
                {t("bankHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label required>{t("currencyLabel")}</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field, fieldState }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={mode === "edit"}
                   items={currencyItems}>
                    <SelectTrigger className="w-full" aria-invalid={!!fieldState.error}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} · {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.currency?.message} />
              {mode === "edit" ? (
                <p className="text-xs text-muted-foreground">{t("currencyLockedHint")}</p>
              ) : null}
            </div>

            {!card && !loan ? (
              <div className="space-y-2">
                <Label htmlFor="starting_balance">{t("startingBalanceLabel")}</Label>
                <Input id="starting_balance" type="number" step="0.01" {...register("starting_balance")} />
              </div>
            ) : null}

            {card ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="current_balance">{t("currentBalanceOwedLabel")}</Label>
                  <Input id="current_balance" type="number" step="0.01" min="0" {...register("current_balance")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credit_limit" required>{t("creditLimitLabel")}</Label>
                  <Input
                    id="credit_limit"
                    type="number"
                    step="0.01"
                    min="0"
                    aria-invalid={!!errors.credit_limit}
                    {...register("credit_limit")}
                  />
                  <FieldError message={errors.credit_limit?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last4">{t("last4Label")}</Label>
                  {/* Optional. When empty the card face keeps inferring digits
                      from the account name, which was the only source before
                      this field existed. Not type="number": leading zeroes are
                      significant here and a spinner makes no sense on digits
                      that are an identifier rather than a quantity. */}
                  <Input
                    id="last4"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder={t("last4Placeholder")}
                    {...register("last4", {
                      onChange: (e) => {
                        e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
                      },
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statement_closing_day" required>{t("statementClosingDayLabel")}</Label>
                  <Input
                    id="statement_closing_day"
                    type="number"
                    min="1"
                    max="31"
                    aria-invalid={!!errors.statement_closing_day}
                    {...register("statement_closing_day")}
                  />
                  <FieldError message={errors.statement_closing_day?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_due_day" required>{t("paymentDueDayLabel")}</Label>
                  <Input
                    id="payment_due_day"
                    type="number"
                    min="1"
                    max="31"
                    aria-invalid={!!errors.payment_due_day}
                    {...register("payment_due_day")}
                  />
                  <FieldError message={errors.payment_due_day?.message} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t("cardGroupLabel")}</Label>
                  <Controller
                    control={control}
                    name="card_group_id"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} items={groupItems}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("noGroup")}</SelectItem>
                          {cardGroups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="new">{t("newGroup")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {/* No digits field here: a group takes its digits from its
                      lines, each of which has its own. */}
                  {groupSel === "new" ? (
                    <Input
                      placeholder={t("groupNamePlaceholder")}
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {t("groupHint")}
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2 rounded-lg border bg-muted/30 p-4">
                  <Controller
                    control={control}
                    name="has_welcome_bonus_goal"
                    render={({ field }) => (
                      <div className="flex items-center justify-between">
                        <Label htmlFor="has_welcome_bonus_goal" className="font-normal">
                          {t("welcomeBonusToggleLabel")}
                        </Label>
                        <Switch
                          id="has_welcome_bonus_goal"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </div>
                    )}
                  />
                  {hasBonusGoal ? (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="welcome_bonus_goal_amount" required>{t("welcomeBonusGoalAmountLabel")}</Label>
                        <Input
                          id="welcome_bonus_goal_amount"
                          type="number"
                          step="0.01"
                          min="0"
                          aria-invalid={!!errors.welcome_bonus_goal_amount}
                          {...register("welcome_bonus_goal_amount")}
                        />
                        <FieldError message={errors.welcome_bonus_goal_amount?.message} />
                      </div>
                      <div className="space-y-2">
                        <Label required>{t("welcomeBonusGoalCurrencyLabel")}</Label>
                        <Controller
                          control={control}
                          name="welcome_bonus_goal_currency"
                          render={({ field, fieldState }) => (
                            <Select value={field.value} onValueChange={field.onChange} items={currencyItems}>
                              <SelectTrigger className="w-full" aria-invalid={!!fieldState.error}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {currencies.map((c) => (
                                  <SelectItem key={c.code} value={c.code}>
                                    {c.code} · {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FieldError message={errors.welcome_bonus_goal_currency?.message} />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="welcome_bonus_due_date" required>{t("welcomeBonusDueDateLabel")}</Label>
                        <Input
                          id="welcome_bonus_due_date"
                          type="date"
                          aria-invalid={!!errors.welcome_bonus_due_date}
                          {...register("welcome_bonus_due_date")}
                        />
                        <FieldError message={errors.welcome_bonus_due_date?.message} />
                      </div>
                    </div>
                  ) : null}
                  <p className="mt-3 text-xs text-muted-foreground">{t("welcomeBonusHint")}</p>
                </div>
              </>
            ) : null}

            {loan ? (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                    {t("loanHint")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="principal" required>{t("principalLabel")}</Label>
                  <Input
                    id="principal"
                    type="number"
                    step="0.01"
                    min="0"
                    aria-invalid={!!errors.principal}
                    {...register("principal")}
                  />
                  <FieldError message={errors.principal?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interest_rate">{t("interestRateLabel")}</Label>
                  <Input id="interest_rate" type="number" step="0.0001" min="0" placeholder={t("interestRatePlaceholder")} {...register("interest_rate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term_months" required>{t("termMonthsLabel")}</Label>
                  <Input
                    id="term_months"
                    type="number"
                    min="1"
                    aria-invalid={!!errors.term_months}
                    {...register("term_months")}
                  />
                  <FieldError message={errors.term_months?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="original_term_months">{t("originalTermMonthsLabel")}</Label>
                  <Input
                    id="original_term_months"
                    type="number"
                    min="1"
                    placeholder={t("originalTermPlaceholder")}
                    {...register("original_term_months")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installment_amount" required>{t("installmentAmountLabel")}</Label>
                  <Input
                    id="installment_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    aria-invalid={!!errors.installment_amount}
                    {...register("installment_amount")}
                  />
                  <FieldError message={errors.installment_amount?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_due_day">{t("paymentDueDayLabel")}</Label>
                  <Input id="payment_due_day" type="number" min="1" max="31" {...register("payment_due_day")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_date">{t("startDateLabel")}</Label>
                  <Input id="start_date" type="date" {...register("start_date")} />
                </div>
              </>
            ) : null}
          </div>

          {/* Fee settings. Only bank and investment accounts move money via
              wire/ACH transfers that can carry a tax or network fee. */}
          {hasTransferFees(type) ? (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">{t("transferFeesHeading")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="transfer_tax_rate">{t("taxRateLabel")}</Label>
                  <Input id="transfer_tax_rate" type="number" step="0.0001" min="0" placeholder={t("taxRatePlaceholder")} {...register("transfer_tax_rate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="network_fee_amount">{t("networkFeeLabel")}</Label>
                  <Input id="network_fee_amount" type="number" step="0.01" min="0" {...register("network_fee_amount")} />
                </div>
              </div>
              <Controller
                control={control}
                name="network_fee_optional"
                render={({ field }) => (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="network_fee_optional" className="font-normal text-muted-foreground">
                      {t("networkFeeOptionalLabel")}
                    </Label>
                    <Switch
                      id="network_fee_optional"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </div>
                )}
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending} isLoading={pending}>
              {pending ? tc("saving") : mode === "create" ? t("addAccountButton") : t("saveChangesButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
