"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Check, LogOut } from "lucide-react";
import { updateBaseCurrency, updateDisplayName } from "@/app/(app)/settings/actions";
import type { CurrencyRow } from "@/lib/accounts/queries";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function Row({
  title,
  description,
  index,
  htmlFor,
  children,
}: {
  title: string;
  description: string;
  index: number;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const Title = htmlFor ? Label : "p";
  return (
    <div
      className="rise flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="space-y-0.5">
        <Title
          {...(htmlFor ? { htmlFor } : {})}
          className="text-sm font-medium text-foreground"
        >
          {title}
        </Title>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPanel({
  email,
  displayName,
  baseCurrency,
  currencies,
}: {
  email: string;
  displayName: string;
  baseCurrency: string;
  currencies: CurrencyRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [currency, setCurrency] = useState(baseCurrency);
  const [name, setName] = useState(displayName);
  const [savedName, setSavedName] = useState(displayName);
  const [namePending, startNameTransition] = useTransition();
  const t = useTranslations("Settings");

  const nameDirty = name.trim() !== savedName.trim();

  /* Without `items`, Base UI's `<Select.Value>` shows the raw value, so the
     closed trigger read "USD" instead of "USD · US Dollar". */
  const currencyItems: Record<string, string> = Object.fromEntries(
    currencies.map((c) => [c.code, `${c.code} · ${c.name}`]),
  );

  function onSaveName() {
    if (!nameDirty) return;
    const next = name.trim();
    startNameTransition(async () => {
      const result = await updateDisplayName(next);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSavedName(next);
      setName(next);
      toast.success(t("toastDisplayNameUpdated"));
      router.refresh();
    });
  }

  function onCurrency(code: string) {
    setCurrency(code);
    startTransition(async () => {
      const result = await updateBaseCurrency(code);
      if (result.error) {
        toast.error(result.error);
        setCurrency(baseCurrency);
      } else {
        toast.success(t("toastCurrencyUpdated"));
        router.refresh();
      }
    });
  }

  return (
    <Card className="divide-y px-6 py-0">
      <Row
        index={0}
        htmlFor="display-name"
        title={t("displayNameTitle")}
        description={t("displayNameDescription")}
      >
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSaveName();
          }}
        >
          <Input
            id="display-name"
            value={name}
            maxLength={40}
            autoComplete="name"
            disabled={namePending}
            placeholder={t("displayNamePlaceholder")}
            onChange={(e) => setName(e.target.value)}
            className="w-48"
          />
          {/* The save button only exists once there's something to save, so
              the row stays quiet at rest. */}
          <Button
            type="submit"
            size="sm"
            disabled={!nameDirty || namePending}
            className={cn(
              "transition-all duration-200",
              nameDirty
                ? "scale-100 opacity-100"
                : "pointer-events-none w-0 scale-90 overflow-hidden px-0 opacity-0",
            )}
          >
            <Check className="size-4" />
            {t("saveButton")}
          </Button>
        </form>
      </Row>

      <Row index={1} title={t("signedInAsTitle")} description={t("signedInAsDescription")}>
        <span className="text-sm text-muted-foreground">{email || "—"}</span>
      </Row>

      <Row
        index={2}
        title={t("baseCurrencyTitle")}
        description={t("baseCurrencyDescription")}
      >
        <Select
          value={currency}
          onValueChange={(v) => onCurrency(v ?? baseCurrency)}
          disabled={pending}
          items={currencyItems}
        >
          <SelectTrigger className="w-40">
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
      </Row>

      <Row index={3} title={t("themeTitle")} description={t("themeDescription")}>
        <ThemeToggle />
      </Row>

      <Row index={4} title={t("categoriesTitle")} description={t("categoriesDescription")}>
        <Button variant="outline" size="sm" render={<a href="/budgets" />} nativeButton={false}>
          {t("manageCategoriesButton")}
        </Button>
      </Row>

      <Row index={5} title={t("sessionTitle")} description={t("sessionDescription")}>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline" size="sm">
            <LogOut className="size-4" />
            {t("signOutButton")}
          </Button>
        </form>
      </Row>
    </Card>
  );
}
