"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { addCardStatement, setCardBalance } from "@/app/(app)/accounts/actions";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type StatementForm = {
  period_start: string;
  period_end: string;
  statement_balance: string;
  total_balance: string;
  total_debits: string;
  total_credits: string;
  due_date: string;
};

export function ReconcilePanel({
  accountId,
  currency,
  currentBalance,
  latestStatementBalance,
  latestDueDate,
}: {
  accountId: string;
  currency: string;
  currentBalance: number;
  latestStatementBalance: number | null;
  latestDueDate: string | null;
}) {
  const t = useTranslations("AccountDetail");
  const tc = useTranslations("Common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [balance, setBalance] = useState(String(currentBalance));
  const { register, handleSubmit, reset } = useForm<StatementForm>({
    defaultValues: {
      period_start: "",
      period_end: "",
      statement_balance: "",
      total_balance: "",
      total_debits: "",
      total_credits: "",
      due_date: "",
    },
  });

  function onSetBalance() {
    const value = Number(balance);
    startTransition(async () => {
      const result = await setCardBalance(accountId, value);
      if (result.error) toast.error(result.error);
      else {
        toast.success(t("balanceUpdated"));
        router.refresh();
      }
    });
  }

  function onAddStatement(values: StatementForm) {
    startTransition(async () => {
      const result = await addCardStatement({ ...values, account_id: accountId });
      if (result.error) toast.error(result.error);
      else {
        toast.success(t("statementRecorded"));
        reset();
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">{t("reconcileTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("reconcileDescription")}
        </p>
      </div>

      <div className="mt-5 space-y-2">
        <Label htmlFor="owed">{t("currentBalanceOwed")}</Label>
        <div className="flex gap-2">
          <Input
            id="owed"
            type="number"
            step="0.01"
            min="0"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
          <Button variant="outline" onClick={onSetBalance} disabled={pending}>
            {t("update")}
          </Button>
        </div>
      </div>

      <Separator className="my-6" />

      <form onSubmit={handleSubmit(onAddStatement)} className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{t("recordStatementHeading")}</p>
          {latestStatementBalance !== null ? (
            <span className="text-xs text-muted-foreground">
              {t("latestStatementAmount", { amount: formatMoney(latestStatementBalance, currency) })}
              {latestDueDate ? t("dueSuffix", { date: latestDueDate }) : ""}
            </span>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="period_start">{t("periodStart")}</Label>
            <Input id="period_start" type="date" {...register("period_start")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period_end">{t("periodEnd")}</Label>
            <Input id="period_end" type="date" {...register("period_end")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="statement_balance">{t("statementBalance")}</Label>
            <Input id="statement_balance" type="number" step="0.01" {...register("statement_balance")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_balance">{t("totalBalance")}</Label>
            <Input id="total_balance" type="number" step="0.01" {...register("total_balance")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_debits">{t("totalDebits")}</Label>
            <Input id="total_debits" type="number" step="0.01" min="0" {...register("total_debits")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_credits">{t("totalCredits")}</Label>
            <Input id="total_credits" type="number" step="0.01" min="0" {...register("total_credits")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="due_date">{t("paymentDueDate")}</Label>
            <Input id="due_date" type="date" {...register("due_date")} />
          </div>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? tc("saving") : t("recordStatementButton")}
        </Button>
      </form>
    </Card>
  );
}
