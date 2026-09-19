"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorTile } from "@/components/ui/color-tile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CurrencyRow } from "@/lib/accounts/queries";
import { cn } from "@/lib/utils";

/** Title and one line of why, the same on every step. */
export function StepHeading({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

type Action = { label: string; onClick: () => void; disabled?: boolean; pending?: boolean };

/**
 * Back on the left, the way forward on the right. A step with nothing to add
 * yet passes only `skip`, so "Not now" is the one way on instead of a primary
 * button that would suggest something is being saved.
 */
export function StepFooter({
  onBack,
  primary,
  skip,
}: {
  onBack?: () => void;
  primary?: Action;
  skip?: Action;
}) {
  const t = useTranslations("Welcome");
  const busy = !!primary?.pending || !!skip?.pending;
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      <Button
        variant="ghost"
        onClick={onBack}
        disabled={!onBack || busy}
        className={cn(!onBack && "invisible")}
      >
        <ArrowLeft className="size-4" />
        {t("backButton")}
      </Button>
      <div className="flex items-center gap-2">
        {skip ? (
          <Button
            variant={primary ? "ghost" : "outline"}
            onClick={skip.onClick}
            disabled={busy || skip.disabled}
            isLoading={skip.pending}
          >
            {skip.label}
          </Button>
        ) : null}
        {primary ? (
          <Button
            onClick={primary.onClick}
            disabled={busy || primary.disabled}
            isLoading={primary.pending}
          >
            {primary.label}
            <ArrowRight className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** One thing already set up: a card, a loan, a bill. */
export function SavedRow({
  icon,
  color,
  title,
  subtitle,
  trailing,
}: {
  icon: LucideIcon;
  color: string;
  title: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <ColorTile color={color} icon={icon} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {trailing}
    </li>
  );
}

export function CurrencySelect({
  id,
  value,
  onChange,
  currencies,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  currencies: CurrencyRow[];
}) {
  const items: Record<string, string> = Object.fromEntries(
    currencies.map((c) => [c.code, `${c.code} · ${c.name}`]),
  );
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? value)} items={items}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {currencies.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.code} · {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Picks one of the user's accounts; the label carries the currency, because
 *  the account decides what currency the income or bill is in. */
export function AccountSelect({
  id,
  value,
  onChange,
  accounts,
}: {
  id: string;
  value: string;
  onChange: (id: string) => void;
  accounts: { id: string; name: string; currency: string }[];
}) {
  const items: Record<string, string> = Object.fromEntries(
    accounts.map((a) => [a.id, `${a.name} · ${a.currency}`]),
  );
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? value)} items={items}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name} · {a.currency}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Today as a local `YYYY-MM-DD` — the user's calendar day, not UTC's. */
export function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
