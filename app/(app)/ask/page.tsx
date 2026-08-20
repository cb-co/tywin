import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { AskChat } from "@/components/ask/ask-chat";

export default async function AskPage() {
  const t = await getTranslations("Ask");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <AskChat />
    </div>
  );
}
