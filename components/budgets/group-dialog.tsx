"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { createBudgetGroup, updateBudgetGroup } from "@/app/(app)/budgets/group-actions";
import type { BudgetGroupRow } from "@/lib/budgets/queries";
import { SWATCH_CLASS, SWATCHES } from "@/lib/palette";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check } from "lucide-react";

/* A near-copy of CategoryDialog, and deliberately not a generalisation of it.
   The two diverge one field deep: the category dialog carries a group select
   (which group this kind of spending rolls up to) and this one must never grow
   the mirror of it, because a group belonging to a group is the tree the
   single-valued design exists to rule out. Merging them would mean a `kind`
   prop gating that field, which is two components wearing one name. */

type Values = { name: string; emoji: string };

export function GroupDialog({
  mode = "create",
  group,
  trigger,
  /* Optional controlled open — see CategoryDialog's own note. */
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  mode?: "create" | "edit";
  group?: BudgetGroupRow;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (next: boolean) => {
    if (!controlled) setOpenState(next);
    onOpenChangeProp?.(next);
  };
  const [pending, startTransition] = useTransition();
  const [color, setColor] = useState<string>(group?.color ?? SWATCHES[0]);
  const router = useRouter();
  const t = useTranslations("BudgetGroupDialog");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useUiSound();
  const { register, handleSubmit, reset } = useForm<Values>({
    defaultValues: { name: group?.name ?? "", emoji: group?.emoji ?? "" },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({ name: group?.name ?? "", emoji: group?.emoji ?? "" });
      setColor(group?.color ?? SWATCHES[0]);
    }
  }

  function onSubmit(values: Values) {
    startTransition(async () => {
      const payload = { ...values, color };
      const result =
        mode === "edit" && group
          ? await updateBudgetGroup(group.budget_group_id, payload)
          : await createBudgetGroup(payload);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(mode === "edit" ? t("toastUpdated") : t("toastAdded"));
      playSuccess();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger render={trigger as React.ReactElement} /> : null}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {mode === "edit" ? t("editTitle") : t("addTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-16 space-y-2">
              <Label htmlFor="group-emoji">{t("emojiLabel")}</Label>
              <Input
                id="group-emoji"
                placeholder="🏠"
                className="text-center"
                {...register("emoji")}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="group-name">{t("nameLabel")}</Label>
              <Input
                id="group-name"
                placeholder={t("namePlaceholder")}
                {...register("name")}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("colorLabel")}</Label>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={t("colorSwatchAria", { color: c })}
                  aria-pressed={color === c}
                  className={SWATCH_CLASS}
                  data-active={color === c}
                  style={{ backgroundColor: c }}
                >
                  {color === c ? <Check className="size-4" strokeWidth={3} /> : null}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending} isLoading={pending}>
              {pending ? tc("saving") : mode === "edit" ? t("saveChangesButton") : t("addButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
