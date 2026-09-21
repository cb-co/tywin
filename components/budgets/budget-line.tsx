"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { LedgerBlock } from "@/components/papel/ledger-block";
import { LedgerRow } from "@/components/papel/ledger-row";
import { RuleMeter } from "@/components/papel/rule-meter";
import { Stamp } from "@/components/papel/stamp";
import { MoneyDisplay } from "@/components/ui/money-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BudgetStatusMark } from "./budget-status-mark";
import { barPct, meterArgs } from "@/lib/budgets/bar";
import { formatPercent } from "@/lib/format";
import type { BudgetStatus } from "@/lib/budgets/queries";
import { cn } from "@/lib/utils";

/** 28px is fine for a mouse; a thumb wants closer to 40. */
const TOUCH_TARGET = "[@media(hover:none)]:size-9";

export type BudgetLineProps = {
  name: string;
  color: string | null;
  emoji: string | null;
  used: number;
  budget: number;
  status: BudgetStatus;
  currency: string;
  subtitle: string;
  prorated: string | null;
  inputKey: string;
  defaultAmount: number;
  placeholder: string;
  budgetAria: string;
  onSave: (raw: string) => void;
  editControl: React.ReactNode;
  deleteAria: string;
  onDelete: () => void;
  deleting: boolean;
};

/**
 * One budget, printed once for both bands: the category band and the group
 * band are the same money sliced two ways and must look it. Head is a ledger
 * row (stamp, name, "used of budget", tabular used amount and its share); the
 * body is the ruled meter with its status mark, then the inline amount input
 * and the edit/delete controls the old card carried.
 */
export function BudgetLine(p: BudgetLineProps) {
  const t = useTranslations("Budgets");
  const { used, total } = meterArgs(p.used, p.budget);
  return (
    <LedgerBlock
      head={
        <LedgerRow
          lead={<Stamp color={p.color} emoji={p.emoji} name={p.name} size="md" />}
          title={p.name}
          subtitle={p.subtitle}
          amount={<MoneyDisplay amount={p.used} currency={p.currency} size="inline" />}
          meta={formatPercent(barPct(p.used, p.budget))}
        />
      }
    >
      {p.prorated ? <p className="text-xs text-muted-foreground tabular-nums">{p.prorated}</p> : null}
      <div className="flex items-center gap-3">
        <RuleMeter
          className="flex-1"
          used={used}
          total={total}
          near={p.status === "approaching"}
          pct={p.budget > 0 ? (p.used / p.budget) * 100 : undefined}
          label={t("meterLabel", { name: p.name })}
          overLabel={t("statusOver")}
        />
        <BudgetStatusMark status={p.status} overLabel={t("statusOver")} nearLabel={t("statusApproaching")} />
      </div>
      <div className="flex items-center gap-1">
        <Input
          key={p.inputKey}
          type="number"
          step="0.01"
          min="0"
          defaultValue={p.defaultAmount || ""}
          placeholder={p.placeholder}
          aria-label={p.budgetAria}
          className="h-8 flex-1 tabular-nums"
          onBlur={(e) => p.onSave(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        {p.editControl}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={p.deleteAria}
          className={cn("text-muted-foreground hover:text-destructive", TOUCH_TARGET)}
          onClick={p.onDelete}
          disabled={p.deleting}
          isLoading={p.deleting}
        >
          {p.deleting ? null : <Trash2 className="size-4" />}
        </Button>
      </div>
    </LedgerBlock>
  );
}
