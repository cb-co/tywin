import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { TriageList } from "@/components/imports/triage-list";
import { getImportTriage } from "@/lib/statements/triage";
import { getQuickAddData } from "@/lib/transactions/queries";

export default async function ImportTriagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fresh?: string }>;
}) {
  const { id } = await params;
  const { fresh } = await searchParams;
  const [triage, quickAdd] = await Promise.all([getImportTriage(id), getQuickAddData()]);
  if (!triage) notFound();
  const t = await getTranslations("Imports");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription", {
          fileName: triage.fileName,
          account: triage.accountName,
        })}
      />

      {/* The summary line ("N de M categorizadas automáticamente" vs. the
          plain "faltan N por categorizar") lives inside TriageList, not here.
          It has to: `fresh=1` stays in the URL for the whole visit, and every
          assignment calls `router.refresh()`, which re-runs this page and
          would otherwise recompute `categorizedLines` to include the user's
          own taps — crediting the rules engine with them. TriageList is the
          one thing here that survives a refresh without remounting, so it is
          the only place that can freeze the arrival numbers. */}
      <TriageList
        importId={triage.importId}
        groups={triage.groups}
        categories={quickAdd.categories}
        categoryOrder={quickAdd.categoryOrder}
        totalLines={triage.totalLines}
        categorizedLines={triage.categorizedLines}
        fresh={fresh === "1"}
      />
    </div>
  );
}
