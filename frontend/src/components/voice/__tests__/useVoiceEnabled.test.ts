/**
 * useVoiceEnabled — la voix suit l'API (`voice_available`), puis le plan.
 */

import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const mockUseAuth = vi.fn();
vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

import { useVoiceEnabled } from "../hooks/useVoiceEnabled";

function voiceFor(user: Record<string, unknown> | null) {
  mockUseAuth.mockReturnValue({ user });
  return renderHook(() => useVoiceEnabled()).result.current;
}

describe("useVoiceEnabled", () => {
  it("enables voice when the API has it and the plan includes it", () => {
    const voice = voiceFor({ plan: "pro", voice_available: true });
    expect(voice.voiceAvailable).toBe(true);
    expect(voice.voiceEnabled).toBe(true);
  });

  it("follows the API even on a plan with voice", () => {
    expect(voiceFor({ plan: "pro", voice_available: false })).toMatchObject({
      voiceAvailable: false,
      voiceEnabled: false,
    });
    // API plus ancienne, sans le champ : pas de voix.
    expect(voiceFor({ plan: "expert" }).voiceEnabled).toBe(false);
  });

  it("keeps the free plan locked while voice is available", () => {
    expect(voiceFor({ plan: "free", voice_available: true })).toMatchObject({
      voiceAvailable: true,
      voiceEnabled: false,
    });
  });

  it("lets the admin call on any plan", () => {
    expect(
      voiceFor({ plan: "free", is_admin: true, voice_available: true })
        .voiceEnabled,
    ).toBe(true);
    expect(
      voiceFor({
        plan: "free",
        email: "MaximeLeparc3@gmail.com",
        voice_available: true,
      }).voiceEnabled,
    ).toBe(true);
  });

  it("is off without a user", () => {
    expect(voiceFor(null).voiceEnabled).toBe(false);
  });
});
