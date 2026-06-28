import { afterEach, describe, expect, it, vi } from "vitest";
import { getLatestVersion, isOutdated, shouldCheck } from "../src/version.js";

describe("isOutdated", () => {
  it("is true when latest is a higher release", () => {
    expect(isOutdated("1.1.0", "1.2.0")).toBe(true);
    expect(isOutdated("1.1.0", "2.0.0")).toBe(true);
    expect(isOutdated("1.1.0", "1.1.1")).toBe(true);
  });

  it("is false when current is equal or higher", () => {
    expect(isOutdated("1.1.0", "1.1.0")).toBe(false);
    expect(isOutdated("1.2.0", "1.1.0")).toBe(false);
    expect(isOutdated("2.0.0", "1.9.9")).toBe(false);
  });

  it("ignores pre-release suffixes on the core version", () => {
    expect(isOutdated("1.1.0", "1.2.0-beta.1")).toBe(true);
    expect(isOutdated("1.1.0-rc.1", "1.1.0")).toBe(false);
  });

  it("is false for unparseable input", () => {
    expect(isOutdated("not-a-version", "1.0.0")).toBe(false);
    expect(isOutdated("1.0.0", "")).toBe(false);
    expect(isOutdated("1.0", "1.1.0")).toBe(false);
  });
});

describe("shouldCheck", () => {
  const original = { CI: process.env.CI, NO_UPDATE_NOTIFIER: process.env.NO_UPDATE_NOTIFIER };

  afterEach(() => {
    process.env.CI = original.CI;
    process.env.NO_UPDATE_NOTIFIER = original.NO_UPDATE_NOTIFIER;
  });

  it("is false when CI is set", () => {
    process.env.CI = "1";
    delete process.env.NO_UPDATE_NOTIFIER;
    expect(shouldCheck()).toBe(false);
  });

  it("is false when NO_UPDATE_NOTIFIER is set", () => {
    delete process.env.CI;
    process.env.NO_UPDATE_NOTIFIER = "1";
    expect(shouldCheck()).toBe(false);
  });

  it("is true when neither opt-out is set", () => {
    delete process.env.CI;
    delete process.env.NO_UPDATE_NOTIFIER;
    expect(shouldCheck()).toBe(true);
  });
});

describe("getLatestVersion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the version from a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: "2.3.4" }),
      }),
    );
    expect(await getLatestVersion("@nbialk/mcplint")).toBe("2.3.4");
  });

  it("returns null on a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await getLatestVersion("@nbialk/mcplint")).toBe(null);
  });

  it("returns null when fetch throws (offline or timeout)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await getLatestVersion("@nbialk/mcplint")).toBe(null);
  });

  it("returns null when the body has no version string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    expect(await getLatestVersion("@nbialk/mcplint")).toBe(null);
  });
});
