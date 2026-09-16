"use client";

import { useState } from "react";
import { Plus, FolderPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { BudgetGroupRow } from "@/lib/budgets/queries";
import { CategoryDialog } from "./category-dialog";
import { GroupDialog } from "./group-dialog";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Kind = "category" | "group";

/**
 * The page's two "add" actions behind one pill, modelled on the Wallet's
 * `AddAccountControl`: the entry point IS the picker, and choosing a kind both
 * sets it and opens that kind's dialog.
 *
 * It started as a phone fix — on a 375px screen "Añadir grupo" and "Añadir
 * categoría" overrun the toolbar before "Copiar mes anterior" is even on the
 * line — but one pill in the header reads better wide as well, so it is the
 * page's add action at every width and the toolbar no longer carries either
 * button.
 */
export function AddBudgetControl({
  groups = [],
  className,
}: {
  groups?: BudgetGroupRow[];
  className?: string;
}) {
  const t = useTranslations("Budgets");
  const tg = useTranslations("BudgetGroups");
  const [pending, setPending] = useState<Kind | null>(null);

  /* Value→label map for the closed trigger — required by
     lib/select-items.test.ts for any Select rendering a SelectValue. */
  const items: Record<string, string> = {
    category: t("addCategory"),
    group: tg("addGroup"),
  };

  return (
    <>
      <Select
        value={pending ?? ""}
        onValueChange={(v) => setPending(v as Kind)}
        items={items}
      >
        {/* Same class stack as AddAccountControl's trigger, and for the same
            reasons — see its comment for why the primary colors are repeated
            under `dark:` and why the height needs the `!`. */}
        <SelectTrigger
          className={cn(
            buttonVariants({ variant: "default" }),
            "h-10! w-fit justify-start gap-2 border-0 bg-primary text-primary-foreground hover:bg-primary/80 dark:border-0 dark:bg-primary dark:hover:bg-primary/80 data-placeholder:text-primary-foreground [&_svg]:text-primary-foreground",
            className,
          )}
        >
          <Plus className="size-4" />
          <SelectValue placeholder={t("addPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="category">
            <Plus className="size-4" />
            {t("addCategory")}
          </SelectItem>
          <SelectItem value="group">
            <FolderPlus className="size-4" />
            {tg("addGroup")}
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Both mounted, both closed until the picker names one. Controlled here
          rather than trigger-driven, because the trigger is the picker above
          and it is not inside either dialog. */}
      <CategoryDialog
        mode="create"
        groups={groups}
        open={pending === "category"}
        onOpenChange={(next) => {
          if (!next) setPending(null);
        }}
      />
      <GroupDialog
        mode="create"
        open={pending === "group"}
        onOpenChange={(next) => {
          if (!next) setPending(null);
        }}
      />
    </>
  );
}
