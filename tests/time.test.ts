import { describe, expect, it } from "vitest";
import { startOfDayInTimeZone } from "../src/server/time";

describe("startOfDayInTimeZone", () => {
  const noonUtc = new Date("2026-07-22T12:00:00Z");

  it("returns UTC midnight for UTC", () => {
    expect(startOfDayInTimeZone("UTC", noonUtc).toISOString()).toBe("2026-07-22T00:00:00.000Z");
  });

  it("computes local midnight for a negative-offset zone (Los Angeles, PDT -7)", () => {
    // 12:00Z is 05:00 in LA → LA midnight of the 22nd is 07:00Z.
    expect(startOfDayInTimeZone("America/Los_Angeles", noonUtc).toISOString()).toBe(
      "2026-07-22T07:00:00.000Z",
    );
  });

  it("computes local midnight for a positive-offset zone (Sydney, AEST +10)", () => {
    // 12:00Z is 22:00 in Sydney → start of the 22nd there is 2026-07-21T14:00Z.
    expect(startOfDayInTimeZone("Australia/Sydney", noonUtc).toISOString()).toBe(
      "2026-07-21T14:00:00.000Z",
    );
  });

  it("falls back to UTC for a missing or invalid zone", () => {
    expect(startOfDayInTimeZone(undefined, noonUtc).toISOString()).toBe("2026-07-22T00:00:00.000Z");
    expect(startOfDayInTimeZone("Not/AZone", noonUtc).toISOString()).toBe("2026-07-22T00:00:00.000Z");
  });
});
