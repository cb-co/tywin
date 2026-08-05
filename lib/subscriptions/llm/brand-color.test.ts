import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/google", () => ({ google: vi.fn(() => "model") }));

import { generateObject } from "ai";
import { inferBrandColor } from "./brand-color";

const mockReturn = (object: unknown) =>
  (generateObject as unknown as Mock).mockResolvedValue({ object });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("inferBrandColor", () => {
  it("passes through a valid hex", async () => {
    mockReturn({ color: "#E50914" });
    expect(await inferBrandColor("Netflix")).toBe("#E50914");
  });

  /* The bug that made this feature look broken for every subscription. Asked for
     "a 6-digit hex", the model returns `#D97706` for some names and a bare
     `D97706` for others — stably, per name — so a subscription unlucky in its
     name had its colour rejected on every single attempt and stayed neutral
     forever, looking exactly like a name the model could not place. */
  it("accepts a bare hex the model returned without its #", async () => {
    mockReturn({ color: "D97706" });
    expect(await inferBrandColor("Claude")).toBe("#D97706");
  });

  it("accepts a bare hex with surrounding whitespace", async () => {
    mockReturn({ color: "  1DB954 " });
    expect(await inferBrandColor("Spotify")).toBe("#1DB954");
  });

  // The schema constrains `color` to a string, not to a colour. A model that
  // answers "red" or "#FFF" satisfies the schema and would then reach the
  // contrast maths that silently misparses it — #FFF parses as rgb(0, 15, 255),
  // which would pick a foreground for a colour nothing renders.
  it.each(["red", "#FFF", "rgb(1,2,3)", "", "  ", "#12345", "#1234567"])(
    "rejects %o rather than storing it",
    async (color) => {
      mockReturn({ color });
      expect(await inferBrandColor("Netflix")).toBeNull();
    },
  );

  it("returns null when the model call fails", async () => {
    (generateObject as unknown as Mock).mockRejectedValue(new Error("boom"));
    expect(await inferBrandColor("Netflix")).toBeNull();
  });

  /* The call runs inside a save the person is waiting on, and the real endpoint
     answers in ~600ms but can take 50-70s. Without a bound that is a hung
     dialog, so the budget is part of the request, not a nicety. */
  it("bounds the call with an abort signal", async () => {
    mockReturn({ color: "#E50914" });
    await inferBrandColor("Netflix");
    const { abortSignal } = (generateObject as unknown as Mock).mock.calls[0][0];
    expect(abortSignal).toBeInstanceOf(AbortSignal);
  });

  // An abort is not special-cased: a save must not fail because a guess was slow.
  it("returns null when the call is aborted", async () => {
    (generateObject as unknown as Mock).mockRejectedValue(
      Object.assign(new Error("The operation was aborted due to timeout"), {
        name: "TimeoutError",
      }),
    );
    expect(await inferBrandColor("Netflix")).toBeNull();
  });

  // No name, no signal — not worth a network round trip.
  it("does not call the model for a blank name", async () => {
    expect(await inferBrandColor("   ")).toBeNull();
    expect(generateObject).not.toHaveBeenCalled();
  });
});
