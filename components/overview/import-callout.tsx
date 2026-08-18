"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SpotIllustration } from "@/components/brand/spot-illustration";
import { StatementImportDialog } from "@/components/statements/statement-import-dialog";

/**
 * The Overview's only pitch for the statement importer. Rendered only for
 * "never" and "overdue" — the caller drops it entirely once the user is
 * current, so it costs the busiest screen in the app no space once its job is
 * done. No `accountId`: the dialog resolves its own target card, which is the
 * point of mounting it here rather than on a specific card's page.
 */
export function ImportCallout({ state }: { state: "never" | "overdue" }) {
  const t = useTranslations("Overview");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const titleKey = state === "never" ? "importCalloutNeverTitle" : "importCalloutOverdueTitle";
  const bodyKey = state === "never" ? "importCalloutNeverBody" : "importCalloutOverdueBody";

  return (
    <>
      <Card className="relative overflow-hidden p-5">
        {/* Decorative only — same absolute-corner treatment the empty-state
            HeroCard above uses for `scene="chart"`. */}
        <SpotIllustration
          scene="chart"
          className="pointer-events-none absolute -right-4 -top-8 size-36 opacity-10"
        />
        <div className="relative min-w-0 max-w-md">
          <p className="text-lg font-medium text-foreground">{t(titleKey)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t(bodyKey)}</p>
          <Button className="mt-4" onClick={() => setOpen(true)}>
            {t("importCalloutCta")}
          </Button>
        </div>
      </Card>

      <StatementImportDialog open={open} onOpenChange={setOpen} onImported={() => router.refresh()} />
    </>
  );
}
