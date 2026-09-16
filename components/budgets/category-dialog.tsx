"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUiSound } from "@/components/sound/sound-provider";
import { createCategory, updateCategory } from "@/app/(app)/budgets/actions";
import type { BudgetGroupRow, BudgetRow } from "@/lib/budgets/queries";
import { NO_GROUP, toGroupId } from "@/lib/budgets/group-schema";
import { SWATCH_CLASS, SWATCHES } from "@/lib/palette";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check } from "lucide-react";

type Values = { name: string; emoji: string };

export function CategoryDialog({
  mode = "create",
  category,
  /* The groups this category could roll up to. Empty for a user who has never
     made one, and the select below is not rendered at all in that case — zero
     groups, zero new field, so the dialog such a user opens is the dialog they
     have always opened. */
  groups = [],
  trigger,
  /* Optional controlled open, for the one caller that has no trigger of its
     own: AddBudgetControl's picker IS the trigger, and it lives outside this
     component. Every other caller passes a `trigger` and leaves these alone,
     keeping its own uncontrolled behaviour. */
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  mode?: "create" | "edit";
  category?: BudgetRow;
  groups?: BudgetGroupRow[];
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
  const [color, setColor] = useState<string>(category?.color ?? SWATCHES[0]);
  const [groupId, setGroupId] = useState<string>(category?.budget_group_id ?? NO_GROUP);
  const router = useRouter();
  const t = useTranslations("CategoryDialog");
  const tc = useTranslations("Common");
  const { playSuccess, playError } = useUiSound();
  const { register, handleSubmit, reset } = useForm<Values>({
    defaultValues: { name: category?.name ?? "", emoji: category?.emoji ?? "" },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({ name: category?.name ?? "", emoji: category?.emoji ?? "" });
      setColor(category?.color ?? SWATCHES[0]);
      setGroupId(category?.budget_group_id ?? NO_GROUP);
    }
  }

  function onSubmit(values: Values) {
    startTransition(async () => {
      /* `toGroupId` turns the "no group" sentinel into a real null. Sending
         the sentinel string would fail the uuid cast server-side and surface
         as a validation error about a field the user only ever left alone. */
      const payload = { ...values, color, budget_group_id: toGroupId(groupId) };
      const result =
        mode === "edit" && category
          ? await updateCategory(category.category_id, payload)
          : await createCategory(payload);
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
              <Label htmlFor="emoji">{t("emojiLabel")}</Label>
              <Input id="emoji" placeholder="🍔" className="text-center" {...register("emoji")} />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input id="name" placeholder={t("namePlaceholder")} {...register("name")} required />
            </div>
          </div>
          {groups.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="category-group">{t("groupLabel")}</Label>
              <Select
                value={groupId}
                /* Base UI hands back `string | null`; the sentinel means there
                   is no null path out of this select, but the signature has one
                   and it collapses to the sentinel rather than to "". */
                onValueChange={(v) => setGroupId(v ?? NO_GROUP)}
                items={{
                  [NO_GROUP]: t("groupNone"),
                  ...Object.fromEntries(
                    groups.map((g) => [
                      g.budget_group_id,
                      `${g.emoji ? `${g.emoji} ` : ""}${g.name}`,
                    ]),
                  ),
                }}
              >
                <SelectTrigger id="category-group" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GROUP}>{t("groupNone")}</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.budget_group_id} value={g.budget_group_id}>
                      {g.emoji ? `${g.emoji} ` : ""}
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("groupHint")}</p>
            </div>
          ) : null}
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
