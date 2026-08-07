"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { formatDate } from "@/lib/format";
import { useUiSound } from "@/components/sound/sound-provider";
import {
  accountResolver,
  blankToUndefined,
  normalizeFormValues,
  type AccountFormValues,
} from "@/lib/accounts/form-values";
import {
  isCard,
  isLoan,
  hasTransferFees,
  type AccountType,
} from "@/lib/accounts/meta";
import { cardLineName, cardLineSpecs } from "@/lib/accounts/card-lines";
import {
  createAccount,
  updateAccount,
  createCardWithLines,
  createBank,
} from "@/app/(app)/accounts/actions";
import type {
  AccountWithStatus,
  CurrencyRow,
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

type FormValues = AccountFormValues;

const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function defaultsFor(
  account: AccountWithStatus | undefined,
  baseCurrency: string,
  effectiveBonus: CardGroupSibling | null | undefined,
  initialType: AccountType | undefined,
  anchored: boolean,
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
    /* Carried, never shown. A card's group is decided once, by the toggles below, and
       there is no longer a control for moving a card between groups — so this exists
       only to keep an already-grouped card pointed at its group through an edit. */
    card_group_id: account?.card_group_id ?? "",
    /* Structure toggles are a create-time question. An existing card's lines already
       exist as their own accounts; re-answering "is it multi-currency?" on an edit
       could only mean splitting or merging rows, which is not what an edit does. */
    is_multi_currency: false,
    has_installments: false,
    usd_credit_limit: "",
    usd_current_balance: "0",
    installments_credit_limit: "",
    installments_current_balance: "0",
    welcome_bonus_goal_amount: str(bonus?.welcome_bonus_goal_amount),
    /* Blank, not the base currency. A bonus offer is denominated in whatever the issuer
       wrote it in, which is not reliably the card's currency and certainly not the
       profile's — so there is no default worth guessing, and a pre-filled one is a wrong
       answer the user has no reason to look at. Blank makes the Select show its
       placeholder and the schema demand a real choice. */
    welcome_bonus_goal_currency: bonus?.welcome_bonus_goal_currency ?? "",
    welcome_bonus_due_date: bonus?.welcome_bonus_due_date ?? "",
    has_welcome_bonus_goal: bonus?.welcome_bonus_goal_amount != null,
    balance_is_anchored: anchored,
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
  banks,
  baseCurrency = "USD",
  effectiveBonus,
  anchoredTo,
  trigger,
  initialType,
  open: controlledOpen,
  onOpenChange: onOpenChangeProp,
}: {
  mode: "create" | "edit";
  account?: AccountWithStatus;
  currencies: CurrencyRow[];
  banks: BankRow[];
  baseCurrency?: string;
  effectiveBonus?: CardGroupSibling | null;
  /** `period_end` of this card's newest statement, or null/undefined if it has none.
   *  Its presence is what makes the card "anchored" — see the balance field below. */
  anchoredTo?: string | null;
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
  const [newBankName, setNewBankName] = useState("");
  const router = useRouter();
  /* A card with a statement no longer has an editable balance: the database recomputes
     it from that statement plus the payments since, so anything typed here would be
     erased by the next import or payment without a word. Dropping the field is the
     honest version of a box whose value never survived.

     Read off `account`, not the watched `type`, because `defaultsFor` needs it before
     the form exists — and the type is never editable in this dialog anyway. */
  const anchored = mode === "edit" && !!anchoredTo && account?.type === "credit_card";
  const t = useTranslations("AccountForm");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const { playSuccess, playError } = useUiSound();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    // Validates the cleaned values, hands `onSubmit` back the raw ones — see accountResolver.
    resolver: accountResolver(),
    defaultValues: defaultsFor(account, baseCurrency, effectiveBonus, initialType, anchored),
  });

  const type = (useWatch({ control, name: "type" }) ?? "checking") as AccountType;
  const bankSel = useWatch({ control, name: "bank_id" }) ?? "none";
  const hasBonusGoal = useWatch({ control, name: "has_welcome_bonus_goal" }) ?? false;
  const multiCurrency = useWatch({ control, name: "is_multi_currency" }) ?? false;
  const installments = useWatch({ control, name: "has_installments" }) ?? false;
  const currencySel = useWatch({ control, name: "currency" }) ?? baseCurrency;
  const nameSel = useWatch({ control, name: "name" }) ?? "";
  const card = isCard(type);
  const loan = isLoan(type);

  /* The lines this card will be saved as, or [] for an ordinary one-line card.
     Empty is also the "no group" signal — a group exists exactly when a card has
     lines to hold. Only on create: an edit works on one existing line. */
  const lineSpecs =
    card && mode === "create"
      ? cardLineSpecs({ multiCurrency, installments, currency: currencySel })
      : [];
  const grouped = lineSpecs.length > 0;

  /* Value→label maps for the closed trigger. Base UI's `<Select.Value>`
     renders the raw value unless `items` is given on the root. Sentinel
     options ("none", "new") need an entry too. */
  const bankItems: Record<string, string> = {
    none: t("noBank"),
    new: t("newBank"),
    ...Object.fromEntries(banks.map((b) => [b.id, b.name])),
  };
  const currencyItems: Record<string, string> = Object.fromEntries(
    currencies.map((c) => [c.code, `${c.code} · ${c.name}`]),
  );

  // Runs on every open, however it happened — a trigger click (uncontrolled) or the parent
  // flipping `open` itself (controlled create flow). Resetting only inside the old
  // trigger-click handler missed the controlled path entirely.
  useEffect(() => {
    if (!open) return;
    reset(defaultsFor(account, baseCurrency, effectiveBonus, initialType, anchored));
    // Resetting the local "new bank name" input alongside the form on every
    // open, not a derived-state cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNewBankName("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onSubmit(values: FormValues) {
    startTransition(async () => {
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

      // Same normalization the resolver validated, with the sentinel the
      // `createBank` call above just resolved into a real id written back over it.
      const clean = blankToUndefined({
        ...normalizeFormValues(values),
        bank_id: normalizedBank,
      });
      // The per-line limit/balance fields are addressed by name, which the typed
      // record doesn't model — each spec names its own pair. See card-lines.ts.
      const field = (name: keyof FormValues) => (clean as Record<string, unknown>)[name];

      /* Recomputed here rather than read off the render-time `lineSpecs`: this runs
         inside a transition, and the submitted values are the ones that must decide
         what gets created. */
      const specs =
        mode === "create" && values.type === "credit_card"
          ? cardLineSpecs({
              multiCurrency: values.is_multi_currency,
              installments: values.has_installments,
              currency: values.currency,
            })
          : [];

      if (specs.length > 0) {
        const cardName = values.name.trim();
        // Everything but the money is shared across lines — one bank, one set of
        // dates, one welcome bonus, one set of digits. They are one physical card.
        const lines = specs.map((spec) => ({
          ...clean,
          name: cardLineName(cardName, spec, t("lineInstallments")),
          currency: spec.currency,
          credit_limit: field(spec.limitField),
          current_balance: field(spec.balanceField) ?? 0,
          card_group_id: "",
        }));
        const created = await createCardWithLines(cardName, lines as never);
        if (created.error) {
          toast.error(created.error);
          playError();
          return;
        }
        toast.success(t("toastCardAdded"));
        playSuccess();
        setOpen(false);
        router.refresh();
        return;
      }

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

  /* One field, two possible homes. Every other type wants the currency up with the
     name and bank; a loan wants it beside the principal, because "10,000 what?" is the
     question the principal box actually raises. Held as an element rather than
     duplicated so the two placements cannot drift apart. */
  const currencyField = (
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
            items={currencyItems}
          >
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
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger render={trigger as React.ReactElement} /> : null}
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {mode === "create" ? t("addTitleForType", { type }) : t("editTitle")}
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
                placeholder={t("namePlaceholderForType", { type })}
                aria-invalid={!!errors.name}
                {...register("name")}
                required
              />
              <FieldError message={errors.name?.message} />
            </div>

            {/* Half width on a card so the digits sit beside it: the card branch below
                is an odd number of half-fields, which stranded a whole empty slot and
                cost a row of dialog height. Full width everywhere else, where there is
                nothing to pair it with. */}
            {type !== "cash" ? (
              <div className={card ? "space-y-2" : "space-y-2 sm:col-span-2"}>
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
            ) : null}

            {/* Lives here, next to the bank, rather than down in the card branch —
                see the bank block's width above. */}
            {card ? (
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
            ) : null}

            {/* Rendered here for every type but a loan, which places it itself beside
                the principal — see the loan branch. A multi-currency card renders it
                nowhere: its lines are the fixed DOP + USD pair, so the control would
                only collect an answer that is then discarded. */}
            {loan || (grouped && multiCurrency) ? null : currencyField}

            {!card && !loan ? (
              <div className="space-y-2">
                <Label htmlFor="starting_balance">{t("startingBalanceLabel")}</Label>
                <Input id="starting_balance" type="number" step="0.01" {...register("starting_balance")} />
              </div>
            ) : null}

            {card ? (
              <>
                {/* Limit and balance move into the lines section once the card has more
                    than one line — each line carries its own, and a single pair here
                    would be written onto every line, counting the same debt twice. */}
                {grouped ? null : (
                  <>
                    {anchored ? (
                      <div className="space-y-2">
                        <Label>{t("currentBalanceOwedLabel")}</Label>
                        <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                          {t("balanceAnchoredHint", {
                            date: formatDate(anchoredTo!, locale),
                          })}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="current_balance">{t("currentBalanceOwedLabel")}</Label>
                        <Input id="current_balance" type="number" step="0.01" min="0" {...register("current_balance")} />
                      </div>
                    )}
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
                  </>
                )}
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
                {/* What used to be a "Card group" select the person had to understand
                    before they could use it. Two questions about the card in their hand
                    replace it: answer either one and the group, its lines, and their
                    currencies all follow — there is nothing left to assemble by hand,
                    and nothing to get wrong. No group select on edit either: a card's
                    lines are decided when it is created. */}
                {mode === "create" ? (
                  <div className="space-y-4 sm:col-span-2 rounded-lg border bg-muted/30 p-4">
                    <Controller
                      control={control}
                      name="has_installments"
                      render={({ field }) => (
                        <div className="flex items-center justify-between">
                          <Label htmlFor="has_installments" className="font-normal">
                            {t("installmentsToggleLabel")}
                          </Label>
                          <Switch
                            id="has_installments"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </div>
                      )}
                    />
                    <Controller
                      control={control}
                      name="is_multi_currency"
                      render={({ field }) => (
                        <div className="flex items-center justify-between">
                          <Label htmlFor="is_multi_currency" className="font-normal">
                            {t("multiCurrencyToggleLabel")}
                          </Label>
                          <Switch
                            id="is_multi_currency"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </div>
                      )}
                    />

                    {grouped ? (
                      <div className="space-y-2 border-t pt-3">
                        <p className="text-sm font-medium">{t("cardLinesHeading")}</p>
                        {lineSpecs.map((spec) => {
                          const suffix =
                            spec.key === "installments" ? t("lineInstallments") : spec.currency;
                          return (
                            <div
                              key={spec.key}
                              className="space-y-2 rounded-md border bg-background p-3"
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                {/* The name this line will actually be saved under, live.
                                    The old flow gave no hint of what it was about to
                                    create until it had created it. */}
                                <p className="truncate text-sm font-medium">
                                  {nameSel.trim()
                                    ? cardLineName(nameSel.trim(), spec, suffix)
                                    : suffix}
                                </p>
                                {/* Only the installments line needs this: every other
                                    line's title IS its currency, and printing "DOP" twice
                                    on one row reads as a bug. */}
                                {spec.key === "installments" ? (
                                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                                    {spec.currency}
                                  </span>
                                ) : null}
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor={`${spec.key}_credit_limit`} required>
                                    {t("creditLimitLabel")}
                                  </Label>
                                  <Input
                                    id={`${spec.key}_credit_limit`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    aria-invalid={!!errors[spec.limitField]}
                                    {...register(spec.limitField)}
                                  />
                                  <FieldError message={errors[spec.limitField]?.message} />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`${spec.key}_current_balance`}>
                                    {t("currentBalanceOwedLabel")}
                                  </Label>
                                  <Input
                                    id={`${spec.key}_current_balance`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    aria-invalid={!!errors[spec.balanceField]}
                                    {...register(spec.balanceField)}
                                  />
                                  <FieldError message={errors[spec.balanceField]?.message} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    <p className="text-xs text-muted-foreground">
                      {grouped ? t("cardStructureGroupedHint") : t("cardStructureHint")}
                    </p>
                  </div>
                ) : null}
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
                                <SelectValue placeholder={t("welcomeBonusGoalCurrencyPlaceholder")} />
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
                {/* Beside the principal, where the amount raises the question. */}
                {currencyField}
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
