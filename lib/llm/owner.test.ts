import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { isOwner, modelForUser, ownerModel } from "./owner";

const FALLBACK = "gemini-3.5-flash-lite";

beforeEach(() => {
  delete process.env.OWNER_EMAIL;
  delete process.env.OWNER_MODEL;
});
afterEach(() => {
  delete process.env.OWNER_EMAIL;
  delete process.env.OWNER_MODEL;
});

describe("isOwner", () => {
  it("matches the configured address", () => {
    process.env.OWNER_EMAIL = "me@example.com";
    expect(isOwner("me@example.com")).toBe(true);
  });

  it("ignores case and surrounding whitespace on both sides", () => {
    process.env.OWNER_EMAIL = "  Me@Example.com ";
    expect(isOwner("me@example.COM")).toBe(true);
  });

  it("is false for anyone else", () => {
    process.env.OWNER_EMAIL = "me@example.com";
    expect(isOwner("someone@example.com")).toBe(false);
  });

  /* The opted-out default. Every environment that has not set the var must
     behave exactly as it did before this existed. */
  it("is false for everyone when OWNER_EMAIL is unset", () => {
    expect(isOwner("me@example.com")).toBe(false);
  });

  it("is false when OWNER_EMAIL is set to an empty string", () => {
    process.env.OWNER_EMAIL = "   ";
    expect(isOwner("me@example.com")).toBe(false);
  });

  it("is false for a user with no email", () => {
    process.env.OWNER_EMAIL = "me@example.com";
    expect(isOwner(null)).toBe(false);
    expect(isOwner(undefined)).toBe(false);
  });
});

describe("modelForUser", () => {
  it("gives the owner the owner model", () => {
    process.env.OWNER_EMAIL = "me@example.com";
    expect(modelForUser("me@example.com", FALLBACK)).toBe("gemini-3.7-flash");
  });

  it("gives everyone else the caller's own model", () => {
    process.env.OWNER_EMAIL = "me@example.com";
    expect(modelForUser("someone@example.com", FALLBACK)).toBe(FALLBACK);
  });

  it("gives the caller's own model when nothing is configured", () => {
    expect(modelForUser("me@example.com", FALLBACK)).toBe(FALLBACK);
  });

  it("honours an OWNER_MODEL override", () => {
    process.env.OWNER_EMAIL = "me@example.com";
    process.env.OWNER_MODEL = "gemini-3.6-flash";
    expect(modelForUser("me@example.com", FALLBACK)).toBe("gemini-3.6-flash");
    expect(ownerModel()).toBe("gemini-3.6-flash");
  });
});
