"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { Upload, Trash2, FileText, ChevronDown, ChevronRight } from "lucide-react";
import {
  deleteCardStatement,
  getStatementLineDetail,
  type StatementLineDetail,
} from "@/app/(app)/accounts/statement-actions";
import type { CardStatementRow } from "@/lib/accounts/queries";
import { formatMoney, formatDate } from "@/lib/format";
import { useUiSound } from "@/components/sound/sound-provider";
import { StatementImportDialog } from "@/components/statements/statement-import-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function StatementsPanel({
  accountId,
  currency,
  statements,
}: {
  accountId: string;
  currency: string;
  statements: CardStatementRow[];
}) {
  const t = useTranslations("Statements");
  const tc = useTranslations("Common");
  const tTxn = useTranslations("Transactions");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { playSuccess, playError } = useUiSound();
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, StatementLineDetail[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  function onToggleLines(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!lines[id]) {
      setBusyId(id);
      startTransition(async () => {
        try {
          const detail = await getStatementLineDetail(id);
          setLines((prev) => ({ ...prev, [id]: detail }));
        } finally {
          setBusyId(null);
        }
      });
    }
  }

  function onDelete(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await deleteCardStatement(id, accountId);
      if (result.error) {
        toast.error(result.error);
        playError();
        setBusyId(null);
        return;
      }
      toast.success(t("statementDeleted"));
      playSuccess();
      setDeleteTarget(null);
      setBusyId(null);
      router.refresh();
    });
  }

  const latest = statements[0];

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        {/* No isLoading here: `pending` now only covers deleting a statement and
            expanding its lines, so tying the spinner to it would spin this
            button for work it did not start. The dialog owns its own pending. */}
        <Button variant="outline" disabled={pending} onClick={() => setImportOpen(true)}>
          <Upload className="mr-1.5 size-4" />
          {t("importButton")}
        </Button>
      </div>

      <Separator className="my-6" />

      {latest?.cost_of_carry != null && latest.interest_rate_annual != null ? (
        <p className="mb-4 text-sm text-muted-foreground">
          {t("costOfCarryStat", {
            amount: formatMoney(Number(latest.cost_of_carry), currency),
            rate: Number(latest.interest_rate_annual),
          })}
        </p>
      ) : null}

      {statements.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {statements.map((s) => (
            <li key={s.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <FileText className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {formatDate(s.period_end, locale)}
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {s.source === "import" ? t("sourceImport") : t("sourceManual")}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.due_date ? t("dueLabel", { date: formatDate(s.due_date, locale) }) : null}
                      {s.minimum_payment != null
                        ? ` · ${t("minimumLabel", { amount: formatMoney(Number(s.minimum_payment), currency) })}`
                        : null}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="figure text-sm">{formatMoney(Number(s.total_balance), currency)}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    isLoading={busyId === s.id}
                    aria-label={expanded === s.id ? t("hideLinesAria") : t("viewLinesAria")}
                    onClick={() => onToggleLines(s.id)}
                  >
                    {busyId === s.id ? null : expanded === s.id ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    isLoading={busyId === s.id}
                    onClick={() => setDeleteTarget(s.id)}
                  >
                    {busyId === s.id ? null : <Trash2 className="size-4" />}
                  </Button>
                </div>
              </div>

              {expanded === s.id ? (
                <div className="mt-3 space-y-1.5 border-t pt-3">
                  {lines[s.id] === undefined ? (
                    <p className="text-xs text-muted-foreground">{t("linesLoading")}</p>
                  ) : lines[s.id].length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("linesEmpty")}</p>
                  ) : (
                    lines[s.id].map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1 truncate">
                          <span className="text-muted-foreground">{formatDate(l.madeOn, locale)}</span>{" "}
                          <span className="text-foreground">{l.description}</span>
                          {l.kind === "payment" ? (
                            <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[9px] uppercase text-muted-foreground">
                              {t("linePaymentBadge")}
                            </span>
                          ) : l.amount < 0 ? (
                            <span className="ml-1.5 rounded bg-success/10 px-1 py-0.5 text-[9px] uppercase text-success">
                              {tTxn("refundBadge")}
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "figure shrink-0 tabular-nums",
                            l.amount < 0 ? "text-success" : "text-foreground",
                          )}
                        >
                          {formatMoney(l.amount, currency, { signed: true })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <StatementImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        accountId={accountId}
        onImported={() => router.refresh()}
      />

      {/* Same confirmation pattern as account deletion (account-detail-actions). */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("deleteConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={pending}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && onDelete(deleteTarget)}
              disabled={pending}
              isLoading={pending}
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
