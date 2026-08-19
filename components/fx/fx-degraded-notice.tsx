import { TriangleAlert } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";

/**
 * Says out loud what `convertToBase` does quietly: when the rate table is
 * unavailable, foreign amounts are folded into a base-currency total at 1:1.
 * At ~60 DOP to the dollar that turns RD$500,000 into a $500,000 net worth, so
 * a total shown without this notice is a number the user has no way to doubt.
 *
 * Renders nothing when `currencies` is empty, which is the case for every
 * single-currency user and for every request where the fetch succeeded — the
 * caller can mount it unconditionally.
 */
export async function FxDegradedNotice({
  currencies,
  base,
  className,
}: {
  currencies: string[];
  base: string;
  className?: string;
}) {
  if (currencies.length === 0) return null;

  const t = await getTranslations("Common");
  const locale = await getLocale();
  const list = new Intl.ListFormat(locale, { style: "short", type: "conjunction" }).format(currencies);

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-2xl bg-warning/10 p-4 text-warning ${className ?? ""}`}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium">{t("fxDegradedTitle")}</p>
        <p className="mt-1 text-sm opacity-90">{t("fxDegradedBody", { currencies: list, base })}</p>
      </div>
    </div>
  );
}
