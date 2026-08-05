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
import { hasBrandColor } from "@/lib/subscriptions/brand-color";
import { convertToBase } from "@/lib/fx";
import { readableForeground } from "@/lib/color";
import { formatMoney } from "@/lib/format";
import type { SubscriptionWithRefs } from "@/lib/subscriptions/queries";
import type { QuickAddData } from "@/lib/transactions/queries";
import { useUiSound } from "@/components/sound/sound-provider";
import { SubscriptionFormDialog } from "./subscription-form-dialog";
import { RecordChargeDialog } from "./record-charge-dialog";
import { Button } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/ui/money-display";
import { BrandGlyph } from "@/components/ui/brand-glyph";
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
          <p className="mt-1 leading-none text-foreground">
            <MoneyDisplay amount={monthlyTotal} currency={data.baseCurrency} size="feature" />
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
                  <BrandMark name={sub.name} color={sub.color} logoPath={sub.logoPath} />
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
              {/* Same treatment as a budget card's figure: MoneyDisplay's
                  `stat` size, cents de-emphasised, and mask-aware — the raw
                  formatMoney that used to sit here kept showing real digits
                  while figure masking was on. */}
              <p className="mt-4 leading-none">
                <MoneyDisplay amount={sub.amount} currency={sub.currency} size="stat" />
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
                  /* Deliberately not the primary variant: with one of these per
                     card plus the active toggle, a grid of solid black CTAs
                     drowned out the "add subscription" button that is meant to be
                     the one high-contrast action on the page. */
                  trigger={
                    <Button size="sm" variant="secondary" disabled={pending} isLoading={pending}>
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
                          <Button size="sm" variant="secondary" disabled={pending} isLoading={pending}>
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
 * The service's mark: its logo where we have one, its initial where we do not,
 * on its brand colour either way.
 *
 * Both the colour and the logo are inferred once from the subscription's name
 * and stored on the row (lib/subscriptions/llm/brand.ts). A subscription with no
 * colour resolved — one the model could not place, or one created before this
 * existed — keeps the theme's neutral accent TOKEN rather than some fixed hex,
 * because that is the only fallback that stays correct in both light and dark.
 *
 * The three states DEGRADE INDEPENDENTLY, which is why the fallbacks are written
 * as two separate questions rather than one:
 *
 *   logo + colour    the Spotify mark on Spotify green — what we are aiming at
 *   colour, no logo  the initial on the brand colour — most smaller services
 *   neither          the initial on the theme's accent — a name nobody knows
 *
 * A logo with no usable colour is possible too and lands on the neutral accent,
 * still showing the mark. Nothing here waits on the other half.
 *
 * The glyph's colour is MEASURED from the fill, never assumed, exactly as the
 * letter's was. Brand colours span the whole lightness range in a way card
 * accents do not: Spotify green and a pale yellow both arrive through the same
 * field, and white on the yellow one is invisible.
 *
 * The glyph sits at 55% of the disc rather than filling it. Simple Icons draws
 * every mark to the edges of its 24×24 box, so a mark scaled to the disc would
 * touch the rim; the inset is the optical padding the artwork does not carry
 * itself.
 *
 * `.tile-sheen` is what keeps it from reading as a flat chip, and it is the same
 * utility every ColorTile in the app uses, so the marks belong to one family
 * rather than each being lit their own way. It only darkens, and only away from
 * the centre — which matters more here than on a ColorTile, because this glyph
 * can be near-black on a pale brand colour, and a treatment that lightened the
 * middle would eat exactly that case.
 *
 * Every state carries the same sheen. Skipping it on a fallback would make an
 * unresolved subscription look like a different kind of object rather than the
 * same one awaiting an answer.
 */
function BrandMark({
  name,
  color,
  logoPath,
}: {
  name: string;
  color: string | null;
  /** A Simple Icons path, resolved server-side in lib/subscriptions/queries. */
  logoPath: string | null;
}) {
  // `rounded-full`, like every other avatar. It previously said `rounded-lg` and
  // still drew a circle, because that token is 20px against a 40px box and the
  // browser clamps it — the shape was luck rather than intent.
  const shared =
    "tile-sheen flex size-10 items-center justify-center rounded-full text-sm font-semibold";
  const mark = logoPath ? (
    <BrandGlyph path={logoPath} className="size-[55%]" />
  ) : (
    name[0]?.toUpperCase()
  );

  if (!hasBrandColor(color))
    return <span className={cn(shared, "bg-accent text-accent-foreground")}>{mark}</span>;

  return (
    <span
      className={shared}
      style={{ backgroundColor: color!, color: readableForeground(color!) }}
    >
      {mark}
    </span>
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
