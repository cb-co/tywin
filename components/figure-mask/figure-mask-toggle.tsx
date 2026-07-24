"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useFigureMask } from "./figure-mask-provider";

export function FigureMaskToggle() {
  const { masked, toggle } = useFigureMask();
  const t = useTranslations("Nav");

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={masked ? t("showFigures") : t("hideFigures")}
      onClick={toggle}
    >
      {masked ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </Button>
  );
}
