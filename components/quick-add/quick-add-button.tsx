"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useQuickAdd } from "./quick-add-provider";

export function QuickAddButton() {
  const { setOpen } = useQuickAdd();
  const t = useTranslations("QuickAdd");
  // The one branded control on screen: quick-add is the app's signature
  // action, so it gets the hero gradient rather than reading as just another
  // utility button. `variant="brand"` already supplies the gradient fill,
  // matching foreground ink, `rounded-full`, and `--shadow-float`; only the
  // fixed position and the larger 60px size are added here.
  return (
    <Button
      onClick={() => setOpen(true)}
      variant="brand"
      size="icon"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-50 size-15 transition-transform hover:scale-105 md:bottom-6"
      aria-label={t("title")}
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
