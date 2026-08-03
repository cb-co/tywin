"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
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

type Values = { amount: string; occurred_at: string; note: string; exchange_rate: string };

const today = () => new Date().toISOString().slice(0, 10);

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
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [withdraw, setWithdraw] = useState(false);
  const router = useRouter();
  const t = useTranslations("ContributeDialog");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useUiSound();

  const { register, handleSubmit, reset } = useForm<Values>({
    defaultValues: { amount: "", occurred_at: today(), note: "", exchange_rate: "" },
  });

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
      reset({ amount: "", occurred_at: today(), note: "", exchange_rate: "" });
      setAccountId(accounts[0]?.id ?? "");
      setWithdraw(false);
    }
  }

  function onSubmit(values: Values) {
    if (!accountId) {
      toast.error(t("pickAccount"));
      playError();
      return;
    }
    const magnitude = Math.abs(Number(values.amount));
    if (!Number.isFinite(magnitude) || magnitude === 0) {
      toast.error(t("amountRequired"));
      playError();
      return;
    }
    startTransition(async () => {
      const result = await addContribution({
        goal_id: goal.id,
        account_id: accountId,
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
              <Label htmlFor="contrib-account">{t("accountLabel")}</Label>
              <Select
                value={accountId}
                onValueChange={(v) => setAccountId(v ?? "")}
                items={accountItems}
              >
                <SelectTrigger id="contrib-account" className="w-full">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrib-amount">
                {t("amountLabel", { currency: account?.currency ?? baseCurrency })}
              </Label>
              <Input
                id="contrib-amount"
                type="number"
                step="0.01"
                min="0"
                required
                className="tabular-nums"
                {...register("amount")}
              />
            </div>

            {crossCurrency && (
              <div className="space-y-2">
                <Label htmlFor="contrib-rate">
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
              <Label htmlFor="contrib-date">{t("dateLabel")}</Label>
              <Input id="contrib-date" type="date" required {...register("occurred_at")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrib-note">{t("noteLabel")}</Label>
              <Input id="contrib-note" placeholder={t("notePlaceholder")} {...register("note")} />
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
