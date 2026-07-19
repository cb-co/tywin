"use client";

import { useMemo, useState, useTransition } from "react";
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
import { formatMoney } from "@/lib/format";
import type { SubscriptionWithRefs } from "@/lib/subscriptions/queries";
import type { QuickAddData } from "@/lib/transactions/queries";
import { SubscriptionFormDialog } from "./subscription-form-dialog";
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

  const monthlyTotal = useMemo(
    () =>
      subscriptions
        .filter((s) => s.is_active)
        .reduce((sum, s) => sum + monthlyEquivalent(s.amount, s.billing_cycle as BillingCycle), 0),
    [subscriptions],
  );

  function onAddCharge(id: string) {
    startTransition(async () => {
      const result = await addCharge(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(t("toastChargeLogged"));
        router.refresh();
      }
    });
  }
  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteSubscription(id);
      if (result.error) toast.error(result.error);
      else {
        toast.success(t("toastDeleted"));
        router.refresh();
      }
    });
  }
  function onToggle(id: string, active: boolean) {
    startTransition(async () => {
      const result = await setSubscriptionActive(id, active);
      if (result.error) toast.error(result.error);
      else router.refresh();
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
                <Button size="sm" onClick={() => onAddCharge(sub.id)} disabled={pending}>
                  <Receipt className="size-4" />
                  {t("addCharge")}
                </Button>
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
                >
                  <Trash2 className="size-4" />
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
                      <Button size="sm" variant="outline" onClick={() => onAddCharge(sub.id)} disabled={pending}>
                        {t("chargeShort")}
                      </Button>
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
                      >
                        <Trash2 className="size-4" />
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
