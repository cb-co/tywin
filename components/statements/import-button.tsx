"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatementImportDialog } from "@/components/statements/statement-import-dialog";

/**
 * The one-line way for a server component to offer statement import. Holds the
 * `open` state the dialog needs, and nothing else — no `accountId`, because
 * every host that reaches for this button (the Wallet header, an Insights card
 * with nothing to show) is asking about the user's cards in general, not about
 * one of them. The dialog resolves the target itself.
 */
export function ImportButton({
  variant = "outline",
  size = "default",
}: {
  variant?: "default" | "outline";
  size?: "default" | "sm";
}) {
  const t = useTranslations("Statements");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Upload className="mr-1.5 size-4" />
        {t("importButton")}
      </Button>

      <StatementImportDialog open={open} onOpenChange={setOpen} onImported={() => router.refresh()} />
    </>
  );
}
