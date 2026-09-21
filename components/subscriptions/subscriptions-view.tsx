"use client";

import { cloneElement, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Plus, Repeat, Pencil, Trash2, Receipt } from "lucide-react";
import {
  addCharge,
  deleteSubscription,
  setSubscriptionActive,
} from "@/app/(app)/recurring/actions";
import { nextChargeDate, monthlyEquivalent, type BillingCycle } from "@/lib/subscriptions/cycle";
import { recurringTotals } from "@/lib/subscriptions/totals";
import { chargeCrossesCurrency } from "@/lib/subscriptions/charge";
import { hasBrandColor } from "@/lib/subscriptions/brand-color";
import { readableForeground } from "@/lib/color";
import type { SubscriptionWithRefs } from "@/lib/subscriptions/queries";
import type { QuickAddData } from "@/lib/transactions/queries";
import { useUiSound } from "@/components/sound/sound-provider";
import { SubscriptionFormDialog } from "./subscription-form-dialog";
import { RecordChargeDialog, type RecordAmounts } from "./record-charge-dialog";
import { Button } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/ui/money-display";
import { MaskedMoney } from "@/components/figure-mask/masked-money";
import { BrandGlyph } from "@/components/ui/brand-glyph";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { LedgerBlock } from "@/components/papel/ledger-block";
import { LedgerRow } from "@/components/papel/ledger-row";
import { SectionLegend } from "@/components/papel/section-legend";
import { DoubleRule } from "@/components/papel/double-rule";
import { orderByNext } from "@/lib/subscriptions/order";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const nextLabel = (sub: SubscriptionWithRefs) => {
  const d = nextChargeDate({
    cycle: sub.billing_cycle as BillingCycle,
    anchorDay: sub.anchor_day,
    anchorDate: sub.anchor_date,
  });
  return d ? dateFmt.format(d) : "—";
};

/**
 * "Añadir recurrente", on its own, so the page header can hold it. It was in
 * the totals card's own toolbar, which on a phone meant a third band of chrome
 * above the first card — the header's title line had room for it and nothing
 * else in it.
 */
export function AddSubscriptionControl({
  data,
  className,
}: {
  data: QuickAddData;
  className?: string;
}) {
  const t = useTranslations("Subscriptions");
  return (
    <SubscriptionFormDialog
      mode="create"
      data={data}
      trigger={
        <Button className={className}>
          <Plus className="size-4" />
          {t("addSubscription")}
        </Button>
      }
    />
  );
}

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
  const tType = useTranslations("TransactionTypes");
  const tCycle = useTranslations("BillingCycles");
  const { playSuccess, playDelete, playError } = useUiSound();

  /* Two base-currency figures, both converted before summing — see
     lib/subscriptions/totals, which owns the arithmetic and the reasoning for
     keeping income out of the outgoing figure rather than netting the two. */
  const totals = useMemo(
    () => recurringTotals(subscriptions, data.baseCurrency, data.rates),
    [subscriptions, data.baseCurrency, data.rates],
  );

  /* Income and everything else render as two separate bands rather than one
     mixed list — a paycheck sorted alphabetically next to a Netflix bill
     reads as noise, not information. Only worth the extra headings when both
     groups actually exist: a user with no income templates yet, or one whose
     list is all income, sees the same flat list as before. */
  const incomeSubs = orderByNext(subscriptions.filter((s) => s.kind === "income"));
  const otherSubs = orderByNext(subscriptions.filter((s) => s.kind !== "income"));
  const showBands = incomeSubs.length > 0 && otherSubs.length > 0;

  /* Resolves to whether the charge saved, so RecordChargeDialog can stay open on
     failure rather than closing optimistically and taking the amount the person
     typed with it. Wrapped in a promise instead of dropping startTransition,
     which is what drives every button's pending state. */
  function onAddCharge(id: string, amounts?: RecordAmounts): Promise<boolean> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await addCharge(id, amounts);
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

  const renderBlock = (sub: SubscriptionWithRefs) => {
    const monthly = monthlyEquivalent(sub.amount, sub.billing_cycle as BillingCycle);
    return (
      <LedgerBlock
        key={sub.id}
        className={cn(!sub.is_active && "opacity-60")}
        head={
          <LedgerRow
            lead={<BrandMark name={sub.name} color={sub.color} logoPath={sub.logoPath} />}
            title={sub.name}
            subtitle={`${sub.kind !== "expense" ? `${tType(sub.kind)} · ` : ""}${tCycle(sub.billing_cycle as BillingCycle)}`}
            amount={<MoneyDisplay amount={sub.amount} currency={sub.currency} size="inline" />}
            meta={t("nextPrefix", { date: nextLabel(sub) })}
          />
        }
      >
        {monthly !== sub.amount ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {t.rich("monthlyEquivalent", {
              amount: () => <MaskedMoney amount={monthly} currency={sub.currency} />,
            })}
          </p>
        ) : null}
        {accountLine(sub) ? <p className="truncate text-xs text-muted-foreground">{accountLine(sub)}</p> : null}
        {/* The control row, unchanged in content and order: Switch, edit and
            delete on the left, Record at the right edge. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Switch
              checked={sub.is_active}
              onCheckedChange={(v) => onToggle(sub.id, v)}
              aria-label={t("activeAria")}
              className="mr-1"
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
          <ChargeButton
            sub={sub}
            rates={data.rates}
            pending={pending}
            onCharge={onAddCharge}
            /* Deliberately not the primary variant: with one of these per card
               plus the active toggle, a grid of solid black CTAs drowned out the
               "add recurring" button that is meant to be the one high-contrast
               action on the page. */
            trigger={
              <Button size="sm" variant="secondary" disabled={pending} isLoading={pending}>
                <Receipt className="size-4" />
                {t("addCharge")}
              </Button>
            }
          />
        </div>
      </LedgerBlock>
    );
  };

  return (
    <div className="space-y-6">
      {/* Plain ruled totals, no note: this screen is read and edited
          repeatedly. Money out and money in are peers at one size. Income
          is teal and also carries its own label, so colour never alone. */}
      <div className="flex flex-wrap items-start gap-x-10 gap-y-4 border-y-2 border-(--rule) py-4">
        <div>
          <p className="legend text-[11px] text-muted-foreground">{t("monthlyRecurring")}</p>
          <p className="mt-1 leading-none text-foreground">
            <MoneyDisplay amount={totals.outgoing} currency={data.baseCurrency} size="feature" />
          </p>
        </div>
        {incomeSubs.length > 0 && (
          <div>
            <p className="legend text-[11px] text-muted-foreground">{t("monthlyIncome")}</p>
            <p className="mt-1 leading-none text-(--teal)">
              <MoneyDisplay amount={totals.income} currency={data.baseCurrency} size="feature" />
            </p>
          </div>
        )}
      </div>

      {subscriptions.length === 0 ? (
        <EmptyState
          icon={<Repeat className="size-6" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="space-y-6">
          {showBands && (
            <div className="space-y-3">
              <SectionLegend>{t("sectionIncome")}</SectionLegend>
              <Card className="gap-0 overflow-hidden p-0">{incomeSubs.map(renderBlock)}</Card>
            </div>
          )}
          {showBands && <DoubleRule />}
          <div className="space-y-3">
            {showBands && <SectionLegend>{t("sectionOther")}</SectionLegend>}
            <Card className="gap-0 overflow-hidden p-0">
              {(showBands ? otherSubs : orderByNext(subscriptions)).map(renderBlock)}
            </Card>
          </div>
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
 * There is no gloss: the old sheen utility is retired with the rest of the
 * tile look. A hairline `ring-(--rule)` does its one useful job instead,
 * keeping a pale brand colour from dissolving into the paper.
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
    "flex size-10 items-center justify-center rounded-full text-sm font-semibold ring-1 ring-(--rule)";
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
 * Record, in both the grid and the table.
 *
 * Recording only needs asking about when currencies differ — the template bills
 * in something other than its account's currency, or a payment's two accounts
 * hold different ones. Everything else — the gym billed in pesos on a peso
 * card, a rent transfer between two peso accounts — records straight through on
 * one tap, because there is nothing to convert and so nothing to ask.
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
  onCharge: (id: string, amounts?: RecordAmounts) => Promise<boolean>;
  trigger: React.ReactElement;
}) {
  const accountCurrency = sub.account?.currency;
  const dstCurrency = sub.kind === "payment" ? sub.to_account?.currency : null;
  const crossLeg = !!accountCurrency && !!dstCurrency && dstCurrency !== accountCurrency;
  // Cloned rather than wrapped in a clickable span, so the button stays the only
  // interactive element and keeps its own keyboard behaviour.
  if (!chargeCrossesCurrency(sub.currency, accountCurrency) && !crossLeg)
    return cloneElement(trigger as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => onCharge(sub.id),
    });

  return (
    <RecordChargeDialog
      subscription={sub}
      accountCurrency={accountCurrency!}
      destinationCurrency={crossLeg ? dstCurrency : null}
      rates={rates}
      pending={pending}
      onConfirm={(amounts) => onCharge(sub.id, amounts)}
      trigger={trigger}
    />
  );
}

/** "Popular Checking", or "Popular Checking → Visa Gold" for a payment. */
function accountLine(sub: SubscriptionWithRefs): string {
  if (sub.kind === "payment" && sub.account && sub.to_account)
    return `${sub.account.name} → ${sub.to_account.name}`;
  return sub.account?.name ?? "";
}
