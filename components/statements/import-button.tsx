"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
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
  className,
  iconOnlyOnMobile = false,
}: {
  variant?: "default" | "outline";
  size?: "default" | "sm";
  /** For hosts that mount it twice and let width pick the visible one. */
  className?: string;
  /** Below `sm` collapse to a square icon button so it fits beside a title. */
  iconOnlyOnMobile?: boolean;
}) {
  const t = useTranslations("Statements");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn(iconOnlyOnMobile && "max-sm:size-9 max-sm:px-0", className)}
        aria-label={iconOnlyOnMobile ? t("importButton") : undefined}
        onClick={() => setOpen(true)}
      >
        <Upload className={cn("size-4", iconOnlyOnMobile ? "sm:mr-1.5" : "mr-1.5")} />
        {iconOnlyOnMobile ? <span className="max-sm:hidden">{t("importButton")}</span> : t("importButton")}
      </Button>

      <StatementImportDialog open={open} onOpenChange={setOpen} onImported={() => router.refresh()} />
    </>
  );
}
