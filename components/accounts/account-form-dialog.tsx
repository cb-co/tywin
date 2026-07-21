"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import {
  CREATABLE_TYPES,
  isCard,
  isLoan,
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
} from "@/lib/accounts/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  statement_closing_day: string;
  payment_due_day: string;
  current_balance: string;
  card_group_id: string;
  principal: string;
  interest_rate: string;
  term_months: string;
  original_term_months: string;
  start_date: string;
  installment_amount: string;
};

const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function defaultsFor(account: AccountWithStatus | undefined, baseCurrency: string): FormValues {
  return {
    name: account?.name ?? "",
    type: (account?.type as AccountType) ?? "checking",
    currency: account?.currency ?? baseCurrency,
    bank_id: account?.bank_id ?? "none",
    starting_balance: str(account?.starting_balance) || "0",
    transfer_tax_rate: str(account?.transfer_tax_rate) || "0.002",
    network_fee_amount: str(account?.network_fee_amount) || "0",
    network_fee_optional: account?.network_fee_optional ?? true,
    credit_limit: str(account?.credit_limit),
    statement_closing_day: str(account?.statement_closing_day),
    payment_due_day: str(account?.payment_due_day),
    current_balance: str(account?.current_balance) || "0",
    card_group_id: account?.card_group_id ?? "none",
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
  trigger,
}: {
  mode: "create" | "edit";
  account?: AccountWithStatus;
  currencies: CurrencyRow[];
  cardGroups: CardGroupRow[];
  banks: BankRow[];
  baseCurrency?: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [newGroupName, setNewGroupName] = useState("");
  const [newBankName, setNewBankName] = useState("");
  const router = useRouter();
  const t = useTranslations("AccountForm");
  const tType = useTranslations("AccountTypes");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useUiSound();

  const { register, handleSubmit, control, reset } = useForm<FormValues>({
    defaultValues: defaultsFor(account, baseCurrency),
  });

  const type = (useWatch({ control, name: "type" }) ?? "checking") as AccountType;
  const groupSel = useWatch({ control, name: "card_group_id" }) ?? "none";
  const bankSel = useWatch({ control, name: "bank_id" }) ?? "none";
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
  const typeItems: Record<string, string> = Object.fromEntries(
    CREATABLE_TYPES.map((accType) => [accType, tType(accType)]),
  );

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset(defaultsFor(account, baseCurrency));
      setNewGroupName("");
      setNewBankName("");
    }
  }

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

      const clean = Object.fromEntries(
        Object.entries({ ...values, card_group_id: normalizedGroup, bank_id: normalizedBank }).map(
          ([k, v]) => [k, v === "" ? undefined : v],
        ),
      ) as Record<string, unknown>;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
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
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input id="name" placeholder={t("namePlaceholder")} {...register("name")} required />
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
              <Label>{t("typeLabel")}</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} items={typeItems}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREATABLE_TYPES.map((accType) => (
                        <SelectItem key={accType} value={accType}>
                          {tType(accType)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("currencyLabel")}</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={mode === "edit"}
                   items={currencyItems}>
                    <SelectTrigger className="w-full">
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
                  <Label htmlFor="credit_limit">{t("creditLimitLabel")}</Label>
                  <Input id="credit_limit" type="number" step="0.01" min="0" {...register("credit_limit")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statement_closing_day">{t("statementClosingDayLabel")}</Label>
                  <Input id="statement_closing_day" type="number" min="1" max="31" {...register("statement_closing_day")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_due_day">{t("paymentDueDayLabel")}</Label>
                  <Input id="payment_due_day" type="number" min="1" max="31" {...register("payment_due_day")} />
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
                  <Label htmlFor="principal">{t("principalLabel")}</Label>
                  <Input id="principal" type="number" step="0.01" min="0" {...register("principal")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interest_rate">{t("interestRateLabel")}</Label>
                  <Input id="interest_rate" type="number" step="0.0001" min="0" placeholder={t("interestRatePlaceholder")} {...register("interest_rate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term_months">{t("termMonthsLabel")}</Label>
                  <Input id="term_months" type="number" min="1" {...register("term_months")} />
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
                  <Label htmlFor="installment_amount">{t("installmentAmountLabel")}</Label>
                  <Input id="installment_amount" type="number" step="0.01" min="0" {...register("installment_amount")} />
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

          {/* Fee settings */}
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

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? tc("saving") : mode === "create" ? t("addAccountButton") : t("saveChangesButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
