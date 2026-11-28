/**
 * Tests — utils/apiTime.ts::parseApiTimestamp
 *
 * Le backend sérialise ses DateTime sans fuseau (UTC) : sans correction,
 * Date.parse les lit en heure locale et décale l'historique du chat.
 */

import { parseApiTimestamp } from "../../src/utils/apiTime";

describe("parseApiTimestamp", () => {
  const expected = Date.UTC(2026, 10, 28, 8, 0, 0, 123);

  it("reads a naive ISO datetime from the API as UTC", () => {
    expect(parseApiTimestamp("2026-11-28T08:00:00.123")).toBe(expected);
    expect(parseApiTimestamp("2026-11-28T08:00:00.123456")).toBe(expected);
  });

  it("keeps an explicit Z or ±hh:mm offset", () => {
    expect(parseApiTimestamp("2026-11-28T08:00:00.123Z")).toBe(expected);
    expect(parseApiTimestamp("2026-11-28T09:00:00.123+01:00")).toBe(expected);
    expect(parseApiTimestamp("2026-11-28T03:00:00.123-0500")).toBe(expected);
  });

  it("returns NaN when there is no usable date", () => {
    expect(parseApiTimestamp(undefined)).toBeNaN();
    expect(parseApiTimestamp(null)).toBeNaN();
    expect(parseApiTimestamp("")).toBeNaN();
    expect(parseApiTimestamp("pas une date")).toBeNaN();
  });
});
