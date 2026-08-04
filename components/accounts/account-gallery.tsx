"use client";

import { Plus, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { AccountCard } from "./account-card";
import { CardGroupTile } from "./card-group-tile";
import { AccountFormDialog } from "./account-form-dialog";
import { ACCOUNT_GROUPS, accountTypeMeta, type GroupKey } from "@/lib/accounts/meta";
import type {
  AccountWithStatus,
  CurrencyRow,
  CardGroupRow,
  BankRow,
} from "@/lib/accounts/queries";
import { Button } from "@/components/ui/button";
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

export function AccountGallery({
  accounts,
  currencies,
  cardGroups,
  banks,
  baseCurrency,
}: {
  accounts: AccountWithStatus[];
  currencies: CurrencyRow[];
  cardGroups: CardGroupRow[];
  banks: BankRow[];
  baseCurrency: string;
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
        icon={<Wallet className="size-6" />}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={
          <AccountFormDialog
            mode="create"
            currencies={currencies}
            cardGroups={cardGroups}
            banks={banks}
            baseCurrency={baseCurrency}
            trigger={
              <Button>
                <Plus className="size-4" />
                {t("addFirstAccount")}
              </Button>
            }
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
        <AccountFormDialog
          mode="create"
          currencies={currencies}
          cardGroups={cardGroups}
          banks={banks}
          baseCurrency={baseCurrency}
          trigger={
            <Button>
              <Plus className="size-4" />
              {t("addAccount")}
            </Button>
          }
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
                      last4={cardGroup.last4}
                      artColor={cardGroup.art_color}
                      accounts={cluster.items}
                    />
                  ) : (
                    <AccountCard key={cluster.key} account={cluster.items[0]} />
                  );
                })
              : group.items.map((account) => (
                  <AccountCard key={account.id} account={account} />
                ))}
          </div>
        </section>
      ))}
    </div>
  );
}
