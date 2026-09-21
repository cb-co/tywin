import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/sound/sound-provider", () => ({ useUiSound: () => ({ playSuccess: () => {} }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string, v?: { pct?: number }) => `${k}:${v?.pct ?? ""}` }));

import { GoalStrip } from "./goal-strip";

const goal = { saved: 500, backed: 300, target_amount: 1000 } as never;

describe("GoalStrip", () => {
  it("draws twenty cells", () => {
    expect((renderToStaticMarkup(<GoalStrip goal={goal} />).match(/<i /g) ?? []).length).toBe(20);
  });
  it("reads as an image with the saved percentage by default", () => {
    const html = renderToStaticMarkup(<GoalStrip goal={goal} />);
    expect(html).toContain('role="img"');
    expect(html).toContain("stripLabel:50");
  });
  it("drops the image role when a visible caption already says it", () => {
    const html = renderToStaticMarkup(<GoalStrip goal={goal} decorative />);
    expect(html).not.toContain('role="img"');
    expect(html).toContain('aria-hidden="true"');
  });
  it("marks borrowed-back cells so a hollowed goal is visible without colour", () => {
    expect(renderToStaticMarkup(<GoalStrip goal={goal} />)).toContain("data-cell=\"borrowed\"");
  });
});
