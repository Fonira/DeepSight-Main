import { describe, expect, it } from "vitest";
import { getSpriteFrameIndex } from "../src/sprite-frame";

describe("getSpriteFrameIndex", () => {
  it("returns 0 at midnight", () => {
    expect(getSpriteFrameIndex(new Date(2026, 3, 26, 0, 0, 0))).toBe(0);
  });

  it("returns 12 at noon", () => {
    expect(getSpriteFrameIndex(new Date(2026, 3, 26, 12, 0, 0))).toBe(12);
  });

  it("returns 23 at 23:59", () => {
    expect(getSpriteFrameIndex(new Date(2026, 3, 26, 23, 59, 59))).toBe(23);
  });

  it("rounds down inside an hour slot (12:30 → 12)", () => {
    expect(getSpriteFrameIndex(new Date(2026, 3, 26, 12, 30, 0))).toBe(12);
  });

  it("rounds down at 12:59:59 → 12", () => {
    expect(getSpriteFrameIndex(new Date(2026, 3, 26, 12, 59, 59))).toBe(12);
  });

  it("snaps to the next hour at 13:00", () => {
    expect(getSpriteFrameIndex(new Date(2026, 3, 26, 13, 0, 0))).toBe(13);
  });

  it("returns 1 at 01:00", () => {
    expect(getSpriteFrameIndex(new Date(2026, 3, 26, 1, 0, 0))).toBe(1);
  });

  it("returns 18 at 18:45", () => {
    expect(getSpriteFrameIndex(new Date(2026, 3, 26, 18, 45, 30))).toBe(18);
  });
});
