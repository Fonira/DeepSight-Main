/**
 * Tests — utils/jwt.ts (lecture de l'expiration des access tokens).
 */

import { expiresWithin, getJwtExpiryMs } from "../../src/utils/jwt";
import { makeJwt } from "../helpers/makeJwt";

describe("getJwtExpiryMs", () => {
  it("reads exp (seconds) as milliseconds", () => {
    expect(getJwtExpiryMs(makeJwt({ sub: "1", exp: 1_800_000_000 }))).toBe(
      1_800_000_000_000,
    );
  });

  it("decodes base64url payloads (- and _)", () => {
    // "~~~" donne des '+' et '/' en base64 classique.
    const token = makeJwt({ exp: 1_700_000_000, note: "~~~???>>>" });
    expect(getJwtExpiryMs(token)).toBe(1_700_000_000_000);
  });

  it("returns null for opaque or malformed tokens", () => {
    expect(getJwtExpiryMs("valid-token")).toBeNull();
    expect(getJwtExpiryMs("a.b.c")).toBeNull();
    expect(getJwtExpiryMs(makeJwt({ sub: "1" }))).toBeNull();
    expect(getJwtExpiryMs(null)).toBeNull();
  });
});

describe("expiresWithin", () => {
  const now = 1_800_000_000_000;

  it("is true when the token expires inside the margin or already expired", () => {
    expect(expiresWithin(makeJwt({ exp: now / 1000 + 30 }), 60_000, now)).toBe(
      true,
    );
    expect(expiresWithin(makeJwt({ exp: now / 1000 - 10 }), 60_000, now)).toBe(
      true,
    );
  });

  it("is false for a token valid well beyond the margin, or unreadable", () => {
    expect(
      expiresWithin(makeJwt({ exp: now / 1000 + 50 * 60 }), 60_000, now),
    ).toBe(false);
    expect(expiresWithin("opaque", 60_000, now)).toBe(false);
  });
});
