/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://www.youtube.com/watch?v=initial"}
 */
//
// Tests — voiceCallInjector × FEATURES.voice × couche visuelle de l'API
//
// Le host injecté sur YouTube contient le bouton 🎙️ « Appeler la vidéo »
// (si la voix est activée) et le badge d'analyse visuelle (si l'API a
// la couche visuelle, `user.visual_analysis_available`). Rien à
// afficher → pas de host du tout.

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

function setupWatchPage(visualAnalysisAvailable: boolean): void {
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "https://www.youtube.com/watch?v=abc123");
  chrome.runtime.sendMessage = jest.fn().mockResolvedValue({
    success: true,
    state: {
      plan: "expert",
      trialUsed: false,
      monthlyMinutesUsed: 0,
      visualAnalysisAvailable,
    },
  }) as unknown as typeof chrome.runtime.sendMessage;
}

const host = (): HTMLElement | null =>
  document.getElementById("ds-voice-call-host");

describe("voiceCallInjector × FEATURES.voice × couche visuelle", () => {
  beforeEach(() => {
    removeVoiceCallButton();
    renderVoice.mockClear();
    renderBadge.mockClear();
  });

  afterEach(() => {
    FEATURES.voice = false;
  });

  it("voix coupée + couche visuelle active : host avec le badge seul", async () => {
    FEATURES.voice = false;
    setupWatchPage(true);

    await injectVoiceCallButton();

    expect(host()).not.toBeNull();
    expect(renderVoice).not.toHaveBeenCalled();
    expect(renderBadge).toHaveBeenCalledWith(expect.anything(), {
      plan: "expert",
      videoId: "abc123",
    });
  });

  it("voix coupée + couche visuelle coupée : aucun host", async () => {
    FEATURES.voice = false;
    setupWatchPage(false);

    await injectVoiceCallButton();

    expect(host()).toBeNull();
    expect(renderVoice).not.toHaveBeenCalled();
    expect(renderBadge).not.toHaveBeenCalled();
  });

  it("voix activée + couche visuelle coupée : bouton d'appel seul", async () => {
    FEATURES.voice = true;
    setupWatchPage(false);

    await injectVoiceCallButton();

    expect(host()).not.toBeNull();
    expect(renderVoice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ plan: "expert", videoId: "abc123" }),
    );
    expect(renderBadge).not.toHaveBeenCalled();
  });

  it("voix activée + couche visuelle active : bouton d'appel puis badge", async () => {
    FEATURES.voice = true;
    setupWatchPage(true);

    await injectVoiceCallButton();

    expect(renderVoice).toHaveBeenCalled();
    expect(renderBadge).toHaveBeenCalled();
    expect(renderVoice.mock.invocationCallOrder[0]).toBeLessThan(
      renderBadge.mock.invocationCallOrder[0],
    );
  });
});
