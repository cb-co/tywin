"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { updateBaseCurrency } from "@/app/(app)/settings/actions";
import type { CurrencyRow } from "@/lib/accounts/queries";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPanel({
  email,
  baseCurrency,
  currencies,
}: {
  email: string;
  baseCurrency: string;
  currencies: CurrencyRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [currency, setCurrency] = useState(baseCurrency);

  function onCurrency(code: string) {
    setCurrency(code);
    startTransition(async () => {
      const result = await updateBaseCurrency(code);
      if (result.error) {
        toast.error(result.error);
        setCurrency(baseCurrency);
      } else {
        toast.success("Base currency updated");
        router.refresh();
      }
    });
  }

  return (
    <Card className="divide-y px-6 py-0">
      <Row title="Signed in as" description={email || "—"}>
        <span className="text-sm text-muted-foreground">{email}</span>
      </Row>

      <Row title="Base currency" description="Dashboards and net worth convert into this currency.">
        <Select value={currency} onValueChange={(v) => onCurrency(v ?? baseCurrency)} disabled={pending}>
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

      <Row title="Theme" description="System, light, or dark.">
        <ThemeToggle />
      </Row>

      <Row title="Categories" description="Add or remove categories from the Budgets screen.">
        <Button variant="outline" size="sm" render={<a href="/budgets" />} nativeButton={false}>
          Manage categories
        </Button>
      </Row>

      <Row title="Session" description="Sign out of Cashly on this device.">
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline" size="sm">
            <LogOut className="size-4" />
            Sign out
          </Button>
        </form>
      </Row>
    </Card>
  );
}
