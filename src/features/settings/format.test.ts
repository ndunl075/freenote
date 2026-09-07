import { describe, expect, it } from "vitest";
import { confirmsWipe, formatBytes, usagePercent, WIPE_PHRASE } from "./format";

describe("formatBytes", () => {
  it("handles zero, negatives and garbage", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(Infinity)).toBe("0 B");
  });

  it("keeps bytes whole and larger units to one decimal", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(12.4 * 1024 * 1024)).toBe("12.4 MB");
    expect(formatBytes(2.05 * 1024 ** 3)).toBe("2.1 GB");
  });

  it("stops at terabytes", () => {
    expect(formatBytes(3 * 1024 ** 5)).toBe("3072 TB");
  });
});

describe("usagePercent", () => {
  it("rounds and clamps", () => {
    expect(usagePercent(50, 200)).toBe(25);
    expect(usagePercent(1, 3)).toBe(33);
    expect(usagePercent(500, 200)).toBe(100);
    expect(usagePercent(-1, 200)).toBe(0);
  });

  it("is 0 when the quota is unknown", () => {
    expect(usagePercent(10, 0)).toBe(0);
    expect(usagePercent(10, NaN)).toBe(0);
  });
});

describe("confirmsWipe", () => {
  it("accepts the phrase regardless of case and surrounding space", () => {
    expect(confirmsWipe(WIPE_PHRASE)).toBe(true);
    expect(confirmsWipe("  Delete Everything ")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(confirmsWipe("delete")).toBe(false);
    expect(confirmsWipe("")).toBe(false);
    expect(confirmsWipe("delete everything!")).toBe(false);
  });
});
