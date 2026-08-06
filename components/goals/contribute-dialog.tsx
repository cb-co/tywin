"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { addContribution } from "@/app/(app)/budgets/goal-actions";
import type { ContributableAccount, GoalCardRow } from "@/lib/goals/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FieldError } from "@/components/ui/field-error";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const today = () => new Date().toISOString().slice(0, 10);

function contributionFormSchema(messages: { pickAccount: string; amountRequired: string; pickDate: string }) {
  return z.object({
    account_id: z.string().uuid(messages.pickAccount),
    amount: z.coerce.number().refine((n) => n !== 0, messages.amountRequired),
    occurred_at: z.string().min(1, messages.pickDate),
    note: z.string().trim().max(200).optional().or(z.literal("")),
  });
}

type Values = { account_id: string; amount: string; occurred_at: string; note: string; exchange_rate: string };

export function ContributeDialog({
  goal,
  accounts,
  baseCurrency,
  trigger,
}: {
  goal: GoalCardRow;
  accounts: ContributableAccount[];
  baseCurrency: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [withdraw, setWithdraw] = useState(false);
  const router = useRouter();
  const t = useTranslations("ContributeDialog");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useUiSound();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    // `Values` also carries `exchange_rate`, which `contributionFormSchema` deliberately
    // doesn't validate (it's cross-field/conditional — checked separately in `onSubmit`).
    // A non-raw resolver hands `onSubmit` the *parsed* output instead of the raw values,
    // which would silently drop `exchange_rate` (zod strips unrecognized keys) and would
    // coerce `amount` from string to number — `raw: true` preserves the original submitted
    // values so `onSubmit`'s existing contract keeps working.
    resolver: zodResolver(
      contributionFormSchema({
        pickAccount: t("pickAccount"),
        amountRequired: t("amountRequired"),
        pickDate: t("pickDate"),
      }),
      undefined,
      { raw: true },
    ) as unknown as Resolver<Values, unknown, Values>,
    defaultValues: {
      account_id: accounts[0]?.id ?? "",
      amount: "",
      occurred_at: today(),
      note: "",
      exchange_rate: "",
    },
  });

  const accountId = useWatch({ control, name: "account_id" }) ?? "";
  const account = accounts.find((a) => a.id === accountId);
  // The goal's target is in base currency, so a foreign account needs a rate to
  // convert its contribution. Same shape as `transactions.exchange_rate`.
  const crossCurrency = !!account && account.currency !== baseCurrency;

  /* Value→label map for the closed trigger. Base UI's `<SelectValue>` renders
     the raw value unless `items` is given on the root, which would show a bare
     UUID here. Same fix as the ledger filters (components/transactions/ledger.tsx). */
  const accountItems: Record<string, string> = Object.fromEntries(
    accounts.map((a) => [a.id, `${a.name} · ${a.currency}`]),
  );

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({
        account_id: accounts[0]?.id ?? "",
        amount: "",
        occurred_at: today(),
        note: "",
        exchange_rate: "",
      });
      setWithdraw(false);
    }
  }

  function onSubmit(values: Values) {
    const magnitude = Math.abs(Number(values.amount));
    if (crossCurrency && !(Number(values.exchange_rate) > 0)) {
      toast.error(tc("crossCurrencyRateRequired"));
      playError();
      return;
    }
    startTransition(async () => {
      const result = await addContribution({
        goal_id: goal.id,
        account_id: values.account_id,
        amount: withdraw ? -magnitude : magnitude,
        exchange_rate: crossCurrency ? values.exchange_rate || 1 : 1,
        occurred_at: values.occurred_at,
        note: values.note,
      });
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(withdraw ? t("toastWithdrawn") : t("toastContributed"));
      playSuccess();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">{t("title", { name: goal.name })}</DialogTitle>
        </DialogHeader>
        {accounts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noAccounts")}</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="withdraw">{t("withdrawLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("withdrawHint")}</p>
              </div>
              <Switch id="withdraw" checked={withdraw} onCheckedChange={setWithdraw} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrib-account" required>{t("accountLabel")}</Label>
              <Controller
                control={control}
                name="account_id"
                render={({ field, fieldState }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v ?? "");
                      // A rate typed for the previous account is meaningless for a
                      // different one — clearing it forces a fresh entry instead of
                      // silently converting at the wrong rate (or, for a same-
                      // currency account, hiding a stale value that would only
                      // resurface if the user switches back to a foreign account).
                      setValue("exchange_rate", "");
                    }}
                    items={accountItems}
                  >
                    <SelectTrigger id="contrib-account" className="w-full" aria-invalid={!!fieldState.error}>
                      <SelectValue placeholder={t("accountPlaceholder")} />
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
              <FieldError message={errors.account_id?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrib-amount" required>
                {t("amountLabel", { currency: account?.currency ?? baseCurrency })}
              </Label>
              <Input
                id="contrib-amount"
                type="number"
                step="0.01"
                min="0"
                required
                aria-invalid={!!errors.amount}
                className="tabular-nums"
                {...register("amount")}
              />
              <FieldError message={errors.amount?.message} />
            </div>

            {crossCurrency && (
              <div className="space-y-2">
                <Label htmlFor="contrib-rate" required>
                  {t("rateLabel", { from: account!.currency, to: baseCurrency })}
                </Label>
                <Input
                  id="contrib-rate"
                  type="number"
                  step="0.00000001"
                  min="0.00000001"
                  required
                  className="tabular-nums"
                  {...register("exchange_rate")}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="contrib-date" required>{t("dateLabel")}</Label>
              <Input
                id="contrib-date"
                type="date"
                required
                aria-invalid={!!errors.occurred_at}
                {...register("occurred_at")}
              />
              <FieldError message={errors.occurred_at?.message} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrib-note">{t("noteLabel")}</Label>
              <Input
                id="contrib-note"
                placeholder={t("notePlaceholder")}
                aria-invalid={!!errors.note}
                {...register("note")}
              />
              <FieldError message={errors.note?.message} />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={pending} isLoading={pending}>
                {pending ? tc("saving") : withdraw ? t("withdrawButton") : t("contributeButton")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
