import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Frames illustrative UI (help mocks, empty-state previews) so a specimen
 *  can never be mistaken for the user's real figures. */
export function SpecimenFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  const t = useTranslations("Papel");
  return (
    <figure className={cn("relative rounded-[4px] border border-dashed border-(--ink-soft) p-3 pt-6", className)}>
      <figcaption className="legend absolute left-3 top-1.5 text-[9px] text-muted-foreground">{t("specimen")}</figcaption>
      {children}
    </figure>
  );
}
