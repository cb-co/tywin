"use client";

import { Plus } from "lucide-react";
import { AccountCard } from "./account-card";
import { AccountFormDialog } from "./account-form-dialog";
import { ACCOUNT_GROUPS } from "@/lib/accounts/meta";
import type { AccountWithStatus, CurrencyRow } from "@/lib/accounts/queries";
import { accountTypeMeta } from "@/lib/accounts/meta";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Wallet } from "lucide-react";

export function AccountGallery({
  accounts,
  currencies,
  baseCurrency,
}: {
  accounts: AccountWithStatus[];
  currencies: CurrencyRow[];
  baseCurrency: string;
}) {
  const addButton = (
    <Button>
      <Plus className="size-4" />
      Add account
    </Button>
  );

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
          baseCurrency={baseCurrency}
          trigger={addButton}
        />
      </div>

      {groups.map((group) => (
        <section key={group.key} className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-lg font-medium text-foreground">{group.title}</h2>
            <span className="text-xs text-muted-foreground">{group.blurb}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
