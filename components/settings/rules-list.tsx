"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { updateRule, deleteRule } from "@/app/(app)/settings/rules/actions";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUiSound } from "@/components/sound/sound-provider";
import type { RuleRow } from "@/lib/rules/queries";
import type { QuickAddCategory } from "@/lib/transactions/queries";

export function RulesList({
  rules,
  categories,
}: {
  rules: RuleRow[];
  categories: QuickAddCategory[];
}) {
  const t = useTranslations("Rules");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { pattern: string; categoryId: string }>>(
    {},
  );
  const { playSuccess, playDelete, playError } = useUiSound();

  const categoryItems: Record<string, string> = Object.fromEntries(
    categories.map((c) => [c.id, `${c.emoji ? `${c.emoji} ` : ""}${c.name}`]),
  );

  function draftFor(rule: RuleRow) {
    return drafts[rule.id] ?? { pattern: rule.pattern, categoryId: rule.categoryId };
  }

  function setDraft(rule: RuleRow, patch: Partial<{ pattern: string; categoryId: string }>) {
    setDrafts((d) => ({ ...d, [rule.id]: { ...draftFor(rule), ...patch } }));
  }

  function save(rule: RuleRow) {
    const draft = draftFor(rule);
    setSavingId(rule.id);
    startTransition(async () => {
      const result = await updateRule(rule.id, draft);
      setSavingId(null);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("saved"));
      playSuccess();
      router.refresh();
    });
  }

  function remove(rule: RuleRow) {
    setDeletingId(rule.id);
    startTransition(async () => {
      const result = await deleteRule(rule.id);
      setDeletingId(null);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("deleted"));
      playDelete();
      router.refresh();
    });
  }

  if (rules.length === 0) {
    return <EmptyState title={t("empty")} description={t("emptyBody")} />;
  }

  return (
    <ul className="space-y-3">
      {rules.map((rule) => {
        const draft = draftFor(rule);
        const dirty = draft.pattern !== rule.pattern || draft.categoryId !== rule.categoryId;
        const isMcc = rule.ruleType === "mcc";
        return (
          <li key={rule.id}>
            <Card className="gap-0 p-4">
              <div className="flex items-center gap-2">
                {isMcc ? (
                  <Badge variant="outline" className="shrink-0 uppercase tracking-wide">
                    {t("mccBadge")}
                  </Badge>
                ) : null}
                {/* The pattern is editable because merchantPattern deliberately
                    keeps the issuer's location tail: shortening it by hand here
                    is how a rule is made to cover every branch. An MCC pattern is
                    a numeric code matched exactly, not merchant text — editing
                    it here would invite a typo that silently stops the rule from
                    matching, so it stays read-only. */}
                <Input
                  value={draft.pattern}
                  onChange={(e) => setDraft(rule, { pattern: e.target.value })}
                  disabled={pending || isMcc}
                  aria-label={isMcc ? t("mccPatternAria") : t("patternAria")}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  isLoading={deletingId === rule.id}
                  aria-label={t("deleteAria")}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove(rule)}
                >
                  {deletingId === rule.id ? null : <Trash2 className="size-4" />}
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Select
                  items={categoryItems}
                  value={draft.categoryId}
                  onValueChange={(id) => {
                    if (id) setDraft(rule, { categoryId: id });
                  }}
                  disabled={pending}
                >
                  <SelectTrigger aria-label={t("categoryAria")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.emoji ? `${c.emoji} ` : ""}
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-3">
                  {/* A rule matching 40 lines is load-bearing; one matching 0 is a typo. */}
                  <span className="text-xs text-muted-foreground">
                    {t("matchCount", { count: rule.matches })}
                  </span>
                  <Button
                    size="sm"
                    disabled={pending || !dirty}
                    isLoading={savingId === rule.id}
                    onClick={() => save(rule)}
                  >
                    {t("save")}
                  </Button>
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
