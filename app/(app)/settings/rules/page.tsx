import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { RulesList } from "@/components/settings/rules-list";
import { getMerchantRules } from "@/lib/rules/queries";
import { getQuickAddData } from "@/lib/transactions/queries";

export default async function RulesPage() {
  const [rules, quickAdd] = await Promise.all([getMerchantRules(), getQuickAddData()]);
  const t = await getTranslations("Rules");

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <p className="text-sm text-muted-foreground">{t("retroNote")}</p>
      <RulesList rules={rules} categories={quickAdd.categories} />
    </div>
  );
}
