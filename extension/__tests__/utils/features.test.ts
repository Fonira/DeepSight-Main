// Tests — utils/features : voix = compilée dans le build ET branchée côté API.

import { FEATURES, isVoiceEnabled } from "../../src/utils/features";

describe("isVoiceEnabled", () => {
  afterEach(() => {
    FEATURES.voice = true;
  });

  it("compiles voice in by default (npm run build, Jest)", () => {
    expect(FEATURES.voice).toBe(true);
  });

  it.each([
    ["no user (guest, logged out)", null],
    ["an API without the field", {}],
    ["no ElevenLabs key or kill switch on", { voice_available: false }],
  ])("is off for %s", (_label, user) => {
    expect(isVoiceEnabled(user)).toBe(false);
  });

  it("is on when the API reports voice", () => {
    expect(isVoiceEnabled({ voice_available: true })).toBe(true);
  });

  it("stays off in a build without voice, whatever the API says", () => {
    FEATURES.voice = false;
    expect(isVoiceEnabled({ voice_available: true })).toBe(false);
  });
});
