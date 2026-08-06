"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SpotIllustration } from "@/components/brand/spot-illustration";
import { AccountCard } from "./account-card";
import { CardGroupTile } from "./card-group-tile";
import { AccountFormDialog } from "./account-form-dialog";
import {
  ACCOUNT_GROUPS,
  CREATABLE_TYPES,
  accountTypeMeta,
  type AccountType,
  type GroupKey,
} from "@/lib/accounts/meta";
import type {
  AccountWithStatus,
  CurrencyRow,
  CardGroupRow,
  BankRow,
} from "@/lib/accounts/queries";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";

/** Cluster credit cards by card_group_id; solo cards keep a unique key. */
function clusterCards(items: AccountWithStatus[]) {
  const map = new Map<string, AccountWithStatus[]>();
  const order: string[] = [];
  for (const a of items) {
    const key = a.card_group_id ?? `solo:${a.id}`;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(a);
  }
  return order.map((key) => ({ key, items: map.get(key)! }));
}

/**
 * The "Add account" entry point IS the type picker now: choosing a type both
 * sets it and opens `AccountFormDialog`, which never asks for it again.
 * Replaces what used to be a plain button opening a dialog with type as just
 * another field inside it — see spec §2.
 */
function AddAccountControl({
  currencies,
  cardGroups,
  banks,
  baseCurrency,
  placeholder,
}: {
  currencies: CurrencyRow[];
  cardGroups: CardGroupRow[];
  banks: BankRow[];
  baseCurrency: string;
  placeholder: string;
}) {
  const tType = useTranslations("AccountTypes");
  const [pendingType, setPendingType] = useState<AccountType | null>(null);

  /* Value→label map for the closed trigger — required by lib/select-items.test.ts for any
     Select rendering a SelectValue. */
  const typeItems: Record<string, string> = Object.fromEntries(
    CREATABLE_TYPES.map((accType) => [accType, tType(accType)]),
  );

  return (
    <>
      <Select
        value={pendingType ?? ""}
        onValueChange={(v) => setPendingType(v as AccountType)}
        items={typeItems}
      >
        <SelectTrigger
          className={cn(
            buttonVariants({ variant: "default" }),
            // The trigger's own `dark:bg-input/30`/`dark:hover:bg-input/50` share no
            // conflict group with plain `bg-primary`/`hover:bg-primary/80` (different
            // variant prefix), so twMerge keeps both — in dark mode the trigger's own
            // rule was winning and washing the button out. Repeating the primary colors
            // under `dark:` forces the same solid-pill look the old plain Button had.
            "w-fit justify-start gap-2 border-0 bg-primary text-primary-foreground hover:bg-primary/80 dark:border-0 dark:bg-primary dark:hover:bg-primary/80 data-placeholder:text-primary-foreground",
          )}
        >
          <Plus className="size-4" />
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {CREATABLE_TYPES.map((accType) => {
            const Icon = accountTypeMeta(accType).icon;
            return (
              <SelectItem key={accType} value={accType} className="gap-2 py-2.5">
                <Icon className="size-4" />
                {tType(accType)}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <AccountFormDialog
        mode="create"
        currencies={currencies}
        cardGroups={cardGroups}
        banks={banks}
        baseCurrency={baseCurrency}
        initialType={pendingType ?? undefined}
        open={pendingType !== null}
        onOpenChange={(next) => {
          if (!next) setPendingType(null);
        }}
      />
    </>
  );
}

export function AccountGallery({
  accounts,
  currencies,
  cardGroups,
  banks,
  baseCurrency,
  holder,
}: {
  accounts: AccountWithStatus[];
  currencies: CurrencyRow[];
  cardGroups: CardGroupRow[];
  banks: BankRow[];
  baseCurrency: string;
  /** Cardholder name for card faces — the profile name, as embossed. */
  holder: string;
}) {
  const t = useTranslations("Accounts");
  const groupById = new Map(cardGroups.map((g) => [g.id, g]));
  const groupLabels: Record<GroupKey, { title: string; blurb: string }> = {
    cash: { title: t("groupCashTitle"), blurb: t("groupCashBlurb") },
    assets: { title: t("groupAssetsTitle"), blurb: t("groupAssetsBlurb") },
    cards: { title: t("groupCardsTitle"), blurb: t("groupCardsBlurb") },
    loans: { title: t("groupLoansTitle"), blurb: t("groupLoansBlurb") },
  };

  if (accounts.length === 0) {
    return (
      <EmptyState
        illustration={<SpotIllustration scene="wallet" className="size-28" />}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={
          <AddAccountControl
            currencies={currencies}
            cardGroups={cardGroups}
            banks={banks}
            baseCurrency={baseCurrency}
            placeholder={t("addFirstAccount")}
          />
        }
      />
    );
  }

  const groups = ACCOUNT_GROUPS.map((g) => ({
    ...g,
    items: accounts.filter((a) => accountTypeMeta(a.type).group === g.key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-10">
      <div className="flex justify-end">
        <AddAccountControl
          currencies={currencies}
          cardGroups={cardGroups}
          banks={banks}
          baseCurrency={baseCurrency}
          placeholder={t("addAccount")}
        />
      </div>

      {groups.map((group) => (
        <section key={group.key} className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium text-foreground">{groupLabels[group.key].title}</h2>
            <span className="text-xs text-muted-foreground">{groupLabels[group.key].blurb}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.key === "cards"
              ? clusterCards(group.items).map((cluster) => {
                  // Whether a card belongs to a card_groups row — not how many
                  // currency lines it currently has — decides whether the
                  // group tile (and its one-per-card face) renders. A card
                  // that is the sole member of a fresh group still belongs to
                  // that group, and must still get a face; `cluster.key` is
                  // only ever a real card_group_id when a group exists (solo
                  // cards key off `solo:${id}`, which never matches).
                  const cardGroup = groupById.get(cluster.key);
                  return cardGroup ? (
                    <CardGroupTile
                      key={cluster.key}
                      name={cardGroup.name}
                      brand={cardGroup.brand}
                      artColor={cardGroup.art_color}
                      holder={holder}
                      accounts={cluster.items}
                    />
                  ) : (
                    <AccountCard key={cluster.key} account={cluster.items[0]} holder={holder} />
                  );
                })
              : group.items.map((account) => (
                  <AccountCard key={account.id} account={account} holder={holder} />
                ))}
          </div>
        </section>
      ))}
    </div>
  );
}
