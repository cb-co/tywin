"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Plus } from "lucide-react";
import { ACCOUNT_TYPE_META } from "@/lib/accounts/meta";
import { Button } from "@/components/ui/button";
import { ImportCardStubStep } from "@/components/statements/import-card-stub-step";
import { StatementImportDialog } from "@/components/statements/statement-import-dialog";
import { SavedRow, StepFooter, StepHeading } from "./parts";
import type { StepProps } from "./types";

/**
 * Any number of cards, each a stub — name, currency, last 4 — because limit,
 * closing day and due day are what its first statement backfills. Adding one
 * opens its import straight away; closing that dialog, imported or not, comes
 * back here rather than ending onboarding, so the steps after this still run.
 */
export function StepCards({ data, baseCurrency, onNext, onBack }: StepProps) {
  const t = useTranslations("Welcome");
  const tStatements = useTranslations("Statements");
  const router = useRouter();
  const cards = data.accounts.filter((a) => a.type === "credit_card");
  const [adding, setAdding] = useState(cards.length === 0);
  const [importFor, setImportFor] = useState<string | null>(null);
  const meta = ACCOUNT_TYPE_META.credit_card;

  return (
    <>
      <div className="space-y-5">
        <StepHeading title={t("cardsTitle")} body={t("cardsBody")} />

        {cards.length ? (
          <ul className="space-y-2">
            {cards.map((c) => (
              <SavedRow
                key={c.id}
                icon={meta.icon}
                color={meta.color}
                title={c.last4 ? `${c.name} ·· ${c.last4}` : c.name}
                subtitle={c.imported ? t("cardImported") : t("cardNoStatement")}
                trailing={
                  c.imported ? (
                    <Check className="size-4 text-primary" aria-hidden />
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setImportFor(c.id)}>
                      {t("cardImport")}
                    </Button>
                  )
                }
              />
            ))}
          </ul>
        ) : null}

        {adding ? (
          <div className="rounded-xl border bg-card p-4">
            <ImportCardStubStep
              // Remounted per card so the form comes back empty for the next one.
              key={cards.length}
              onCreated={(id) => {
                setAdding(false);
                router.refresh();
                setImportFor(id);
              }}
              submitLabel={tStatements("stubSubmit")}
              defaultCurrency={baseCurrency}
            />
          </div>
        ) : (
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            {cards.length ? t("cardsAddAnother") : t("cardsAdd")}
          </Button>
        )}
      </div>

      <StepFooter
        onBack={onBack}
        primary={cards.length ? { label: t("continueButton"), onClick: onNext } : undefined}
        skip={cards.length ? undefined : { label: t("skipButton"), onClick: onNext }}
      />

      <StatementImportDialog
        open={importFor !== null}
        onOpenChange={(open) => {
          if (!open) setImportFor(null);
        }}
        accountId={importFor ?? undefined}
        onImported={() => router.refresh()}
      />
    </>
  );
}
