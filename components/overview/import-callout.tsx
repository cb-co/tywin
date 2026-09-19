"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/ui/money-display";
import { Note } from "@/components/papel/note";
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
      <div className="border-l-2 border-(--ink) pl-4">
        <p className="text-base font-medium text-foreground">{t(titleKey)}</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{t(bodyKey)}</p>
        <Button className="mt-3" onClick={() => setOpen(true)}>
          {t("importCalloutCta")}
        </Button>
      </div>

      <StatementImportDialog open={open} onOpenChange={setOpen} onImported={() => router.refresh()} />
    </>
  );
}

/** The empty Overview's one Note. Statement import comes first (PRODUCT.md
 *  principle 2); adding an account by hand is the quiet second action. */
export function EmptyOverviewNote({ currency }: { currency: string }) {
  const t = useTranslations("Overview");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Note
        tone="violet"
        label={t("netWorth")}
        action={
          <>
            <Button
              className="border-(--note-ink) bg-(--note-ink) text-(--note) hover:bg-(--note-ink)/90 focus-visible:outline-(--note-ink)"
              onClick={() => setOpen(true)}
            >
              {t("importCalloutCta")}
            </Button>
            <Button
              variant="outline"
              className="border-(--note-ink) bg-transparent text-(--note-ink) hover:bg-transparent focus-visible:outline-(--note-ink)"
              nativeButton={false}
              render={<Link href="/accounts" />}
            >
              {t("addAccount")}
              <ArrowUpRight className="size-4" />
            </Button>
          </>
        }
      >
        <MoneyDisplay amount={0} currency={currency} size="hero" className="[font-stretch:125%] font-extrabold" />
        <p className="mt-3 max-w-md text-sm opacity-85">{t("netWorthEmptyBody")}</p>
      </Note>
      <StatementImportDialog open={open} onOpenChange={setOpen} onImported={() => router.refresh()} />
    </>
  );
}
