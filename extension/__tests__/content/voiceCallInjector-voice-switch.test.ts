/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://www.youtube.com/watch?v=initial"}
 */
//
// Tests — voiceCallInjector × FEATURES.voice
//
// Le host injecté sur YouTube contient le bouton 🎙️ « Appeler la vidéo »
// et le badge d'analyse visuelle. Quand les appels vocaux sont coupés, seul
// le badge doit être rendu ; le host (et donc le badge) reste injecté.

jest.mock("../../src/content/widget", () => ({
  renderVoiceCallButton: jest.fn().mockResolvedValue(undefined),
  renderVisualAnalysisBadge: jest.fn().mockResolvedValue(undefined),
}));

import {
  injectVoiceCallButton,
  removeVoiceCallButton,
} from "../../src/content/voiceCallInjector";
import {
  renderVoiceCallButton,
  renderVisualAnalysisBadge,
} from "../../src/content/widget";
import { FEATURES } from "../../src/utils/features";

const renderVoice = renderVoiceCallButton as jest.Mock;
const renderBadge = renderVisualAnalysisBadge as jest.Mock;

function setupWatchPage(): void {
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "https://www.youtube.com/watch?v=abc123");
  chrome.runtime.sendMessage = jest.fn().mockResolvedValue({
    success: true,
    state: { plan: "expert", trialUsed: false, monthlyMinutesUsed: 0 },
  }) as unknown as typeof chrome.runtime.sendMessage;
}

describe("voiceCallInjector × FEATURES.voice", () => {
  beforeEach(() => {
    removeVoiceCallButton();
    renderVoice.mockClear();
    renderBadge.mockClear();
    setupWatchPage();
  });

  afterEach(() => {
    FEATURES.voice = false;
  });

  it("voix coupée : injecte le host avec le badge visuel, sans bouton d'appel", async () => {
    FEATURES.voice = false;

    await injectVoiceCallButton();

    expect(document.getElementById("ds-voice-call-host")).not.toBeNull();
    expect(renderVoice).not.toHaveBeenCalled();
    expect(renderBadge).toHaveBeenCalledWith(expect.anything(), {
      plan: "expert",
      videoId: "abc123",
    });
  });

  it("voix activée : rend le bouton d'appel puis le badge visuel", async () => {
    FEATURES.voice = true;

    await injectVoiceCallButton();

    expect(renderVoice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ plan: "expert", videoId: "abc123" }),
    );
    expect(renderBadge).toHaveBeenCalled();
    expect(renderVoice.mock.invocationCallOrder[0]).toBeLessThan(
      renderBadge.mock.invocationCallOrder[0],
    );
  });
});
