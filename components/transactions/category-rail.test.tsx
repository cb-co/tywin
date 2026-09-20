import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { CategoryRail } from "./category-rail";

const cats = [
  { id: "a", name: "Comida", emoji: "🍽️", color: "#0E6E60", budget_group_id: null },
  { id: "b", name: "Transporte", emoji: null, color: "#1D4FB8", budget_group_id: null },
];
const html = (value: string) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="es" messages={{ TransactionForm: { categoryLabel: "Categoría", moreCategories: "Más…" } }}>
      <CategoryRail categories={cats as never} value={value} onChange={() => {}} onMore={() => {}} />
    </NextIntlClientProvider>,
  );

describe("CategoryRail", () => {
  it("is a radiogroup of stamps, one radio per category", () => {
    const out = html("");
    expect(out).toContain('role="radiogroup"');
    expect(out.match(/role="radio"/g)).toHaveLength(2);
    expect(out).toContain("stamp");
  });

  it("marks only the chosen category checked and inked", () => {
    const out = html("b");
    expect(out.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(out.match(/stamp-inked/g)).toHaveLength(1);
  });

  it("keeps the more control", () => {
    expect(html("")).toContain("Más…");
  });
});
