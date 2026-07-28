"use client";

import { cloneElement, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Plus, Repeat, Pencil, Trash2, Receipt, LayoutGrid, Table as TableIcon } from "lucide-react";
import {
  addCharge,
  deleteSubscription,
  setSubscriptionActive,
} from "@/app/(app)/subscriptions/actions";
import { CYCLE_LABEL, nextChargeDate, monthlyEquivalent, type BillingCycle } from "@/lib/subscriptions/cycle";
import { chargeCrossesCurrency } from "@/lib/subscriptions/charge";
import { convertToBase } from "@/lib/fx";
import { formatMoney } from "@/lib/format";
import type { SubscriptionWithRefs } from "@/lib/subscriptions/queries";
import type { QuickAddData } from "@/lib/transactions/queries";
import { useUiSound } from "@/components/sound/sound-provider";
import { SubscriptionFormDialog } from "./subscription-form-dialog";
import { RecordChargeDialog } from "./record-charge-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const nextLabel = (cycle: BillingCycle, anchor: number | null) => {
  const d = nextChargeDate(cycle, anchor);
  return d ? dateFmt.format(d) : "—";
};

export function SubscriptionsView({
  subscriptions,
  data,
}: {
  subscriptions: SubscriptionWithRefs[];
  data: QuickAddData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("Subscriptions");
  const [view, setView] = useState<"grid" | "table">("grid");
  const { playSuccess, playDelete, playError } = useUiSound();

  /* Converted before summing, since this renders as a single base-currency
     figure. It used to add the raw amounts across currencies, so a DOP 1,500 gym
     membership and a USD 15.99 sub totalled "US$1,515.99 a month". */
  const monthlyTotal = useMemo(
    () =>
      subscriptions
        .filter((s) => s.is_active)
        .reduce(
          (sum, s) =>
            sum +
            convertToBase(
              monthlyEquivalent(s.amount, s.billing_cycle as BillingCycle),
              s.currency,
              data.baseCurrency,
              data.rates,
            ),
          0,
        ),
    [subscriptions, data.baseCurrency, data.rates],
  );

  /* Resolves to whether the charge saved, so RecordChargeDialog can stay open on
     failure rather than closing optimistically and taking the amount the person
     typed with it. Wrapped in a promise instead of dropping startTransition,
     which is what drives every button's pending state. */
  function onAddCharge(id: string, settledAmount?: number): Promise<boolean> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await addCharge(id, settledAmount);
        if (result.error) {
          toast.error(result.error);
          playError();
          resolve(false);
          return;
        }
        toast.success(t("toastChargeLogged"));
        playSuccess();
        router.refresh();
        resolve(true);
      });
    });
  }
  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteSubscription(id);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        toast.success(t("toastDeleted"));
        playDelete();
        router.refresh();
      }
    });
  }
  function onToggle(id: string, active: boolean) {
    startTransition(async () => {
      const result = await setSubscriptionActive(id, active);
      if (result.error) {
        toast.error(result.error);
        playError();
      } else {
        router.refresh();
      }
    });
  }

  const addTrigger = (
    <Button>
      <Plus className="size-4" />
      {t("addSubscription")}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{t("monthlyRecurring")}</p>
          <p className="figure text-3xl leading-none text-foreground">
            {formatMoney(monthlyTotal, data.baseCurrency)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label={t("gridViewAria")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                view === "grid" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              aria-label={t("tableViewAria")}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                view === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              <TableIcon className="size-4" />
            </button>
          </div>
          <SubscriptionFormDialog mode="create" data={data} trigger={addTrigger} />
        </div>
      </div>

      {subscriptions.length === 0 ? (
        <EmptyState
          icon={<Repeat className="size-6" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((sub) => (
            <Card key={sub.id} className={cn("gap-0 p-5", !sub.is_active && "opacity-60")}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground">
                    {sub.name[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{sub.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {CYCLE_LABEL[sub.billing_cycle as BillingCycle]}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={sub.is_active}
                  onCheckedChange={(v) => onToggle(sub.id, v)}
                  aria-label={t("activeAria")}
                />
              </div>
              <p className="figure mt-4 text-2xl leading-none text-foreground">
                {formatMoney(sub.amount, sub.currency)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("nextPrefix", { date: nextLabel(sub.billing_cycle as BillingCycle, sub.anchor_day) })}
                {sub.account ? ` · ${sub.account.name}` : ""}
              </p>
              <div className="mt-4 flex items-center gap-1">
                <ChargeButton
                  sub={sub}
                  rates={data.rates}
                  pending={pending}
                  onCharge={onAddCharge}
                  trigger={
                    <Button size="sm" disabled={pending} isLoading={pending}>
                      <Receipt className="size-4" />
                      {t("addCharge")}
                    </Button>
                  }
                />
                <SubscriptionFormDialog
                  mode="edit"
                  subscription={sub}
                  data={data}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={t("editAria")}>
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("deleteAria")}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(sub.id)}
                  disabled={pending}
                  isLoading={pending}
                >
                  {pending ? null : <Trash2 className="size-4" />}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">{t("tableColName")}</th>
                <th className="px-4 py-2 font-medium">{t("tableColAmount")}</th>
                <th className="px-4 py-2 font-medium">{t("tableColCycle")}</th>
                <th className="px-4 py-2 font-medium">{t("tableColNext")}</th>
                <th className="px-4 py-2 font-medium">{t("tableColAccount")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("tableColActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subscriptions.map((sub) => (
                <tr key={sub.id} className={cn(!sub.is_active && "opacity-60")}>
                  <td className="px-4 py-2 font-medium text-foreground">{sub.name}</td>
                  <td className="px-4 py-2 tabular-nums">{formatMoney(sub.amount, sub.currency)}</td>
                  <td className="px-4 py-2">{CYCLE_LABEL[sub.billing_cycle as BillingCycle]}</td>
                  <td className="px-4 py-2">{nextLabel(sub.billing_cycle as BillingCycle, sub.anchor_day)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{sub.account?.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <ChargeButton
                        sub={sub}
                        rates={data.rates}
                        pending={pending}
                        onCharge={onAddCharge}
                        trigger={
                          <Button size="sm" variant="outline" disabled={pending} isLoading={pending}>
                            {t("chargeShort")}
                          </Button>
                        }
                      />
                      <SubscriptionFormDialog
                        mode="edit"
                        subscription={sub}
                        data={data}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={t("editAria")}>
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("deleteAria")}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(sub.id)}
                        disabled={pending}
                        isLoading={pending}
                      >
                        {pending ? null : <Trash2 className="size-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Add charge, in both the grid and the table.
 *
 * A charge only needs asking about when the merchant's billing currency differs
 * from the currency its account settles in. Everything else — the gym billed in
 * pesos on a peso card, a dollar sub on a dollar account — records straight
 * through on one tap, exactly as before, because there is nothing to convert and
 * so nothing to ask.
 */
function ChargeButton({
  sub,
  rates,
  pending,
  onCharge,
  trigger,
}: {
  sub: SubscriptionWithRefs;
  rates: Record<string, number>;
  pending: boolean;
  onCharge: (id: string, settledAmount?: number) => Promise<boolean>;
  trigger: React.ReactElement;
}) {
  const accountCurrency = sub.account?.currency;
  // Cloned rather than wrapped in a clickable span, so the button stays the only
  // interactive element and keeps its own keyboard behaviour.
  if (!chargeCrossesCurrency(sub.currency, accountCurrency))
    return cloneElement(trigger as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => onCharge(sub.id),
    });

  return (
    <RecordChargeDialog
      subscription={sub}
      accountCurrency={accountCurrency!}
      rates={rates}
      pending={pending}
      onConfirm={(settledAmount) => onCharge(sub.id, settledAmount)}
      trigger={trigger}
    />
  );
}
