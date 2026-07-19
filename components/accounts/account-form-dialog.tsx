"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CREATABLE_TYPES,
  ACCOUNT_TYPE_META,
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

  const { register, handleSubmit, control, reset } = useForm<FormValues>({
    defaultValues: defaultsFor(account, baseCurrency),
  });

  const type = (useWatch({ control, name: "type" }) ?? "checking") as AccountType;
  const groupSel = useWatch({ control, name: "card_group_id" }) ?? "none";
  const bankSel = useWatch({ control, name: "bank_id" }) ?? "none";
  const card = isCard(type);
  const loan = isLoan(type);

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
          toast.error("Name the new card group, or pick “No group”.");
          return;
        }
        const created = await createCardGroup(newGroupName.trim());
        if (created.error) {
          toast.error(created.error);
          return;
        }
        cardGroupId = created.id!;
      }
      const normalizedGroup = cardGroupId === "none" || cardGroupId === "new" ? "" : cardGroupId;

      let bankId = values.bank_id;
      if (bankId === "new") {
        if (!newBankName.trim()) {
          toast.error("Name the new bank, or pick “No bank”.");
          return;
        }
        const created = await createBank(newBankName.trim());
        if (created.error) {
          toast.error(created.error);
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
        return;
      }
      toast.success(mode === "create" ? "Account added" : "Account updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {mode === "create" ? "Add an account" : "Edit account"}
          </DialogTitle>
          <DialogDescription>
            {card
              ? "Credit-card balance is reconciled from statements and payments."
              : loan
                ? "Loan payoff is tracked from payments into the loan."
                : "Balance is derived from your transactions."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="e.g. Banco Popular checking" {...register("name")} required />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Bank / institution</Label>
              <Controller
                control={control}
                name="bank_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No bank</SelectItem>
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">New bank…</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {bankSel === "new" ? (
                <Input
                  placeholder="Bank name (e.g. Banco Popular)"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                />
              ) : null}
              <p className="text-xs text-muted-foreground">
                Transfers between accounts at the same bank skip the network fee.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREATABLE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ACCOUNT_TYPE_META[t].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={mode === "edit"}
                  >
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
                <p className="text-xs text-muted-foreground">Currency can&apos;t be changed.</p>
              ) : null}
            </div>

            {!card ? (
              <div className="space-y-2">
                <Label htmlFor="starting_balance">Starting balance</Label>
                <Input id="starting_balance" type="number" step="0.01" {...register("starting_balance")} />
              </div>
            ) : null}

            {card ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="current_balance">Current balance owed</Label>
                  <Input id="current_balance" type="number" step="0.01" min="0" {...register("current_balance")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credit_limit">Credit limit</Label>
                  <Input id="credit_limit" type="number" step="0.01" min="0" {...register("credit_limit")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statement_closing_day">Statement closing day</Label>
                  <Input id="statement_closing_day" type="number" min="1" max="31" {...register("statement_closing_day")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_due_day">Payment due day</Label>
                  <Input id="payment_due_day" type="number" min="1" max="31" {...register("payment_due_day")} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Card group</Label>
                  <Controller
                    control={control}
                    name="card_group_id"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No group</SelectItem>
                          {cardGroups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="new">New group…</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {groupSel === "new" ? (
                    <Input
                      placeholder="Group name (e.g. Visa Signature)"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Group two currency lines of the same physical card so they render as one.
                  </p>
                </div>
              </>
            ) : null}

            {loan ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="principal">Principal</Label>
                  <Input id="principal" type="number" step="0.01" min="0" {...register("principal")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interest_rate">Annual interest rate</Label>
                  <Input id="interest_rate" type="number" step="0.0001" min="0" placeholder="0.115 = 11.5%" {...register("interest_rate")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="term_months">Term (months)</Label>
                  <Input id="term_months" type="number" min="1" {...register("term_months")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installment_amount">Monthly installment</Label>
                  <Input id="installment_amount" type="number" step="0.01" min="0" {...register("installment_amount")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_due_day">Payment due day</Label>
                  <Input id="payment_due_day" type="number" min="1" max="31" {...register("payment_due_day")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start date</Label>
                  <Input id="start_date" type="date" {...register("start_date")} />
                </div>
              </>
            ) : null}
          </div>

          {/* Fee settings */}
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Transfer fees</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transfer_tax_rate">Tax rate</Label>
                <Input id="transfer_tax_rate" type="number" step="0.0001" min="0" placeholder="0.002 = 0.20%" {...register("transfer_tax_rate")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="network_fee_amount">Network fee</Label>
                <Input id="network_fee_amount" type="number" step="0.01" min="0" {...register("network_fee_amount")} />
              </div>
            </div>
            <Controller
              control={control}
              name="network_fee_optional"
              render={({ field }) => (
                <div className="flex items-center justify-between">
                  <Label htmlFor="network_fee_optional" className="font-normal text-muted-foreground">
                    Network fee is optional (a free, slower option exists)
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
              {pending ? "Saving…" : mode === "create" ? "Add account" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
