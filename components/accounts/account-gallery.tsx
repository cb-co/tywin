"use client";

import { Plus, Wallet } from "lucide-react";
import { AccountCard } from "./account-card";
import { CardGroupTile } from "./card-group-tile";
import { AccountFormDialog } from "./account-form-dialog";
import { ACCOUNT_GROUPS, accountTypeMeta } from "@/lib/accounts/meta";
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
  const groupName = new Map(cardGroups.map((g) => [g.id, g.name]));

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={<Wallet className="size-6" />}
        title="No accounts yet"
        description="Add your first account to start tracking balances, credit-card utilization, and loan payoff."
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
                Add your first account
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
              Add account
            </Button>
          }
        />
      </div>

      {groups.map((group) => (
        <section key={group.key} className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-lg font-medium text-foreground">{group.title}</h2>
            <span className="text-xs text-muted-foreground">{group.blurb}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.key === "cards"
              ? clusterCards(group.items).map((cluster) =>
                  cluster.items.length >= 2 ? (
                    <CardGroupTile
                      key={cluster.key}
                      name={groupName.get(cluster.key) ?? "Card group"}
                      accounts={cluster.items}
                    />
                  ) : (
                    <AccountCard key={cluster.key} account={cluster.items[0]} />
                  ),
                )
              : group.items.map((account) => (
                  <AccountCard key={account.id} account={account} />
                ))}
          </div>
        </section>
      ))}
    </div>
  );
}
