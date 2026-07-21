"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { BILLING_CYCLES, CYCLE_LABEL, type BillingCycle } from "@/lib/subscriptions/cycle";
import { createSubscription, updateSubscription } from "@/app/(app)/subscriptions/actions";
import type { QuickAddData } from "@/lib/transactions/queries";
import type { SubscriptionWithRefs } from "@/lib/subscriptions/queries";
import { useUiSound } from "@/components/sound/sound-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
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
import { accountOptionLabel } from "@/lib/accounts/meta";

type Values = {
  name: string;
  brand: string;
  amount: string;
  currency: string;
  billing_cycle: BillingCycle;
  anchor_day: string;
  account_id: string;
  category_id: string;
  is_active: boolean;
};

function defaults(sub: SubscriptionWithRefs | undefined, baseCurrency: string): Values {
  return {
    name: sub?.name ?? "",
    brand: sub?.brand ?? "",
    amount: sub ? String(sub.amount) : "",
    currency: sub?.currency ?? baseCurrency,
    billing_cycle: (sub?.billing_cycle as BillingCycle) ?? "monthly",
    anchor_day: sub?.anchor_day ? String(sub.anchor_day) : "",
    account_id: sub?.account_id ?? "none",
    category_id: sub?.category_id ?? "none",
    is_active: sub?.is_active ?? true,
  };
}

export function SubscriptionFormDialog({
  mode,
  subscription,
  data,
  trigger,
}: {
  mode: "create" | "edit";
  subscription?: SubscriptionWithRefs;
  data: QuickAddData;
  trigger: React.ReactNode;
}) {
  const { accounts, categories, currencies, baseCurrency } = data;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations("SubscriptionForm");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useUiSound();

  /* Value→label maps for the closed trigger. Base UI's `<Select.Value>`
     renders the raw value unless `items` is given on the root, which showed
     bare UUIDs and raw cycle keys. Sentinels ("none") need an entry too. */
  const cycleItems: Record<string, string> = CYCLE_LABEL;
  // Label happens to equal the value today; declared anyway so enriching the
  // option text later cannot silently reintroduce a raw-value trigger.
  const currencyItems: Record<string, string> = Object.fromEntries(
    currencies.map((c) => [c.code, c.code]),
  );
  const accountItems: Record<string, string> = {
    none: tc("none"),
    ...Object.fromEntries(accounts.map((a) => [a.id, accountOptionLabel(a)])),
  };
  const categoryItems: Record<string, string> = {
    none: tc("none"),
    ...Object.fromEntries(
      categories.map((c) => [c.id, `${c.emoji ? `${c.emoji} ` : ""}${c.name}`]),
    ),
  };
  const { register, handleSubmit, control, reset } = useForm<Values>({
    defaultValues: defaults(subscription, baseCurrency),
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(defaults(subscription, baseCurrency));
  }

  function onSubmit(values: Values) {
    startTransition(async () => {
      const payload = {
        ...values,
        account_id: values.account_id === "none" ? "" : values.account_id,
        category_id: values.category_id === "none" ? "" : values.category_id,
        anchor_day: values.anchor_day === "" ? undefined : values.anchor_day,
      };
      const result =
        mode === "create"
          ? await createSubscription(payload)
          : await updateSubscription(subscription!.id, payload);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(mode === "create" ? t("toastAdded") : t("toastUpdated"));
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
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input id="name" placeholder={t("namePlaceholder")} {...register("name")} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">{t("brandLabel")}</Label>
              <Input id="brand" placeholder={t("brandPlaceholder")} {...register("brand")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">{t("amountLabel")}</Label>
              <div className="flex gap-2">
                <Input id="amount" type="number" step="0.01" min="0" className="flex-1" {...register("amount")} required />
                <Controller
                  control={control}
                  name="currency"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} items={currencyItems}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("billingCycleLabel")}</Label>
              <Controller
                control={control}
                name="billing_cycle"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} items={cycleItems}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_CYCLES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CYCLE_LABEL[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="anchor_day">{t("chargeDayLabel")}</Label>
              <Input id="anchor_day" type="number" min="1" max="31" placeholder={t("chargeDayPlaceholder")} {...register("anchor_day")} />
            </div>
            <div className="space-y-2">
              <Label>{t("chargeAccountLabel")}</Label>
              <Controller
                control={control}
                name="account_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} items={accountItems}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tc("none")}</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {accountOptionLabel(a)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("categoryLabel")}</Label>
              <Controller
                control={control}
                name="category_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} items={categoryItems}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tc("none")}</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.emoji ? `${c.emoji} ` : ""}
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                <Label htmlFor="is_active" className="font-normal">
                  {t("activeLabel")}
                </Label>
                <Switch id="is_active" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? tc("saving") : mode === "create" ? t("addButton") : t("saveChangesButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
