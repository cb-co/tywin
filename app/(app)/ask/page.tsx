import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { AskChat } from "@/components/ask/ask-chat";
import { initialQuestion } from "@/lib/ask/initial-question";

/**
 * `?q=` arrives from the Overview entry, which is a text box on one page that
 * submits to this one.
 *
 * Read and validated here rather than with `useSearchParams` in the client: the
 * question is a string from outside the app on its way to a model, so it is
 * cleaner to bound it once on the server than to hand the raw param to a
 * component and hope.
 */
export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const t = await getTranslations("Ask");
  const { q } = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
      <AskChat initialQuestion={initialQuestion(Array.isArray(q) ? null : q)} />
    </div>
  );
}
