"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Errors");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" />
      </span>
      <div>
        <p className="text-xl font-medium text-foreground">{t("title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("body")}</p>
      </div>
      <Button onClick={reset}>{t("retry")}</Button>
    </div>
  );
}
