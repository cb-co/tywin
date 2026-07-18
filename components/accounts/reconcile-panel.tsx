"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
        toast.success("Balance updated");
        router.refresh();
      }
    });
  }

  function onAddStatement(values: StatementForm) {
    startTransition(async () => {
      const result = await addCardStatement({ ...values, account_id: accountId });
      if (result.error) toast.error(result.error);
      else {
        toast.success("Statement recorded");
        reset();
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-6">
      <div className="space-y-1">
        <h2 className="font-serif text-lg font-medium">Reconcile</h2>
        <p className="text-sm text-muted-foreground">
          Card balances are maintained, not derived. Update the owed figure or record a statement.
        </p>
      </div>

      <div className="mt-5 space-y-2">
        <Label htmlFor="owed">Current balance owed</Label>
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
            Update
          </Button>
        </div>
      </div>

      <Separator className="my-6" />

      <form onSubmit={handleSubmit(onAddStatement)} className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Record a statement</p>
          {latestStatementBalance !== null ? (
            <span className="text-xs text-muted-foreground">
              Latest {formatMoney(latestStatementBalance, currency)}
              {latestDueDate ? ` · due ${latestDueDate}` : ""}
            </span>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="period_start">Period start</Label>
            <Input id="period_start" type="date" {...register("period_start")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period_end">Period end</Label>
            <Input id="period_end" type="date" {...register("period_end")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="statement_balance">Statement balance</Label>
            <Input id="statement_balance" type="number" step="0.01" {...register("statement_balance")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_balance">Total balance</Label>
            <Input id="total_balance" type="number" step="0.01" {...register("total_balance")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_debits">Total debits</Label>
            <Input id="total_debits" type="number" step="0.01" min="0" {...register("total_debits")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_credits">Total credits</Label>
            <Input id="total_credits" type="number" step="0.01" min="0" {...register("total_credits")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="due_date">Payment due date</Label>
            <Input id="due_date" type="date" {...register("due_date")} />
          </div>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Record statement"}
        </Button>
      </form>
    </Card>
  );
}
