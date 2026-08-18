"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { createCardStub } from "@/app/(app)/accounts/actions";
import { listStubCurrencies } from "@/app/(app)/accounts/statement-actions";
import { useUiSound } from "@/components/sound/sound-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The three questions a card cannot be created without: what it's called, what
 * it's denominated in, and — optionally — which card it is.
 *
 * Deliberately standalone. It is mounted inside the statement import dialog
 * when the user has no card to import onto, and onboarding mounts the very same
 * form for its "add your first card" step, so it must not read anything from
 * the dialog around it. That is why it loads its own currency list rather than
 * taking one as a prop: every other form in the app gets that list from its
 * page, and this one has no page.
 *
 * The limit, closing day and due day the full account form demands are left out
 * on purpose — see `cardStubInput` in lib/accounts/schema.ts. They are exactly
 * the three fields the first statement backfills, so asking for them here would
 * put a five-field form in front of the feature that exists to save typing.
 */
export function ImportCardStubStep({
  onCreated,
  submitLabel,
  defaultCurrency,
}: {
  /** Handed the new account's id. The caller decides what happens next. */
  onCreated: (accountId: string) => void;
  /** Already translated by the caller — the step is reused in flows that word
   *  the commitment differently ("Add and continue" vs "Next"). */
  submitLabel: string;
  /** Preselected currency. Pass "" for "no preference" and the profile's base
   *  currency is used once the list loads. */
  defaultCurrency: string;
}) {
  const t = useTranslations("Statements");
  const { playSuccess, playError } = useUiSound();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [last4, setLast4] = useState("");
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listStubCurrencies().then((result) => {
      if (cancelled) return;
      setCurrencies(result.currencies);
      // Only fills a blank: a caller that named a currency has a reason to
      // (onboarding asks for it a step earlier), and the answer must survive
      // this list arriving late.
      setCurrency((c) => c || result.baseCurrency);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* The selected code always has an entry, even before the list resolves —
     otherwise the trigger would render an empty box over a value that is set. */
  const options =
    !currency || currencies.some((c) => c.code === currency)
      ? currencies
      : [{ code: currency, name: currency }, ...currencies];
  const currencyItems: Record<string, string> = Object.fromEntries(
    options.map((c) => [c.code, `${c.code} · ${c.name}`]),
  );

  const trimmed = name.trim();

  function submit() {
    if (!trimmed || !currency) return;
    startTransition(async () => {
      const result = await createCardStub({
        name: trimmed,
        currency,
        last4: last4 || undefined,
      });
      if (!result.id) {
        if (result.error) toast.error(result.error);
        playError();
        return;
      }
      playSuccess();
      onCreated(result.id);
    });
  }

  return (
    // min-w-0 all the way down: this renders inside DialogContent's grid popup,
    // where a grid item's automatic minimum size is its content. The whitespace-nowrap
    // SelectTrigger below would otherwise widen the modal instead of being clamped by it.
    <form
      className="min-w-0 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("stubHeading")}</p>
        <p className="text-xs text-muted-foreground">{t("stubHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="card-stub-name">{t("stubNameLabel")}</Label>
        <Input
          id="card-stub-name"
          value={name}
          autoFocus
          placeholder={t("stubNamePlaceholder")}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="min-w-0 space-y-2">
        <Label htmlFor="card-stub-currency">{t("stubCurrencyLabel")}</Label>
        <Select
          value={currency}
          onValueChange={(v) => setCurrency(v ?? "")}
          items={currencyItems}
        >
          <SelectTrigger id="card-stub-currency" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} · {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="card-stub-last4">{t("stubLast4Label")}</Label>
        {/* Not type="number": leading zeroes are significant and a spinner makes
            no sense on digits that identify rather than count. Mirrors the same
            field in the full account form. */}
        <Input
          id="card-stub-last4"
          inputMode="numeric"
          maxLength={4}
          placeholder={t("stubLast4Placeholder")}
          value={last4}
          onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />
      </div>

      <Button type="submit" disabled={pending || !trimmed || !currency} isLoading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
