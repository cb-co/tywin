"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Upload, Trash2, FileText } from "lucide-react";
import {
  parseStatement,
  confirmStatementImport,
  deleteCardStatement,
  type StatementPreviewResult,
} from "@/app/(app)/accounts/statement-actions";
import type { CardStatementRow } from "@/lib/accounts/queries";
import { formatMoney } from "@/lib/format";
import { useUiSound } from "@/components/sound/sound-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Preview = NonNullable<StatementPreviewResult["preview"]>;

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { playSuccess, playError } = useUiSound();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});

  function buildFormData(f: File) {
    const fd = new FormData();
    fd.set("file", f);
    fd.set("account_id", accountId);
    if (password) fd.set("password", password);
    return fd;
  }

  function onParse(f: File) {
    startTransition(async () => {
      const result = await parseStatement(buildFormData(f));
      if (result.needsPassword) {
        setNeedsPassword(true);
        return;
      }
      if (result.error || !result.preview) {
        toast.error(result.error ?? t("parseFailed"));
        playError();
        return;
      }
      setNeedsPassword(false);
      setPreview(result.preview);
      setMappings(
        Object.fromEntries(
          result.preview.sections
            .map((s) => [s.sectionKey, s.mappedAccountId ?? s.suggestedAccountId ?? ""])
            .filter(([, v]) => v),
        ),
      );
    });
  }

  function onConfirm() {
    if (!file || !preview) return;
    const fd = buildFormData(file);
    fd.set("mappings", JSON.stringify(mappings));
    startTransition(async () => {
      const result = await confirmStatementImport(fd);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("imported"));
      playSuccess();
      setPreview(null);
      setFile(null);
      setPassword("");
      router.refresh();
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCardStatement(id, accountId);
      if (result.error) {
        toast.error(result.error);
        playError();
        return;
      }
      toast.success(t("statementDeleted"));
      playSuccess();
      router.refresh();
    });
  }

  const latest = statements[0];
  const allMapped = preview?.sections.every((s) => mappings[s.sectionKey]) ?? false;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button variant="outline" disabled={pending} onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1.5 size-4" />
          {t("importButton")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!f) return;
            setFile(f);
            setPassword("");
            setNeedsPassword(false);
            setPreview(null);
            onParse(f);
          }}
        />
      </div>

      {needsPassword && file ? (
        <div className="mt-5 space-y-2">
          <Label htmlFor="stmt-password">{t("passwordLabel")}</Label>
          <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
          <div className="flex gap-2">
            <Input
              id="stmt-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button variant="outline" disabled={pending || !password} onClick={() => onParse(file)}>
              {t("retryButton")}
            </Button>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="mt-5 space-y-4">
          {preview.sections.map((s) => (
            <div key={s.sectionKey} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">
                  {s.sectionKey} · {s.currency} · {s.periodStart} → {s.periodEnd}
                </p>
                <p className="figure text-sm">
                  {formatMoney(Number(s.closingBalance), s.currency)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("sectionSummary", { lines: s.lineCount, payments: s.paymentCount })}
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("mapSectionLabel", { section: s.sectionKey })}</Label>
                <Select
                  value={mappings[s.sectionKey] || "none"}
                  onValueChange={(v) =>
                    setMappings((m) => ({ ...m, [s.sectionKey]: v === "none" ? "" : (v ?? "") }))
                  }
                  items={{
                    none: t("mapSectionNone"),
                    ...Object.fromEntries(preview.accountOptions.map((a) => [a.id, a.name])),
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Clearing frees this section's claim so accounts can be
                        swapped between sections without a deadlock. */}
                    <SelectItem value="none">{t("mapSectionNone")}</SelectItem>
                    {preview.accountOptions
                      .filter(
                        (a) =>
                          a.currency === s.currency &&
                          (mappings[s.sectionKey] === a.id ||
                            !Object.entries(mappings).some(
                              ([key, v]) => key !== s.sectionKey && v === a.id,
                            )),
                      )
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Button disabled={pending || !allMapped} onClick={onConfirm}>
              {t("confirmButton")}
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setPreview(null);
                setFile(null);
                setPassword("");
              }}
            >
              {t("cancelButton")}
            </Button>
          </div>
        </div>
      ) : null}

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
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {s.period_end}
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {s.source === "import" ? t("sourceImport") : t("sourceManual")}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.due_date ? t("dueLabel", { date: s.due_date }) : null}
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
                  onClick={() => {
                    if (window.confirm(t("deleteConfirm"))) onDelete(s.id);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
