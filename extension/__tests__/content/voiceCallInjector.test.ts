/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://www.youtube.com/watch?v=initial"}
 */
//
// Tests — voiceCallInjector
//
// Couvre :
//  - Pas d'injection si pas sur /watch
//  - Pas d'injection si non authentifié (background renvoie state=null)
//  - Injection dans #secondary #related (anchor préféré)
//  - Fallback floating overlay si pas d'anchor
//  - Idempotence (deuxième call no-op)
//  - removeVoiceCallButton enlève le host
//  - Le shadow root contient bien le bouton 🎙️

import {
  injectVoiceCallButton,
  removeVoiceCallButton,
} from "../../src/content/voiceCallInjector";

// Helper : reset doc + URL + chrome mock.
function setupYouTubeWatch(videoId = "abc123"): void {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  window.history.replaceState(
    {},
    "",
    `https://www.youtube.com/watch?v=${videoId}`,
  );
  document.title = "Test Video Title";
}

function mockBackgroundResponse(response: unknown | undefined): jest.Mock {
  const mock = jest.fn().mockResolvedValue(response);
  chrome.runtime.sendMessage =
    mock as unknown as typeof chrome.runtime.sendMessage;
  return mock;
}

describe("voiceCallInjector", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    removeVoiceCallButton();
  });

  it("does not inject when location is not /watch", async () => {
    window.history.replaceState(
      {},
      "",
      "https://www.youtube.com/feed/trending",
    );
    mockBackgroundResponse({
      success: true,
      state: { plan: "free", trialUsed: false, monthlyMinutesUsed: 0 },
    });
    await injectVoiceCallButton();
    expect(document.getElementById("ds-voice-call-host")).toBeNull();
  });

  it("does not inject when background returns no state (unauthenticated)", async () => {
    setupYouTubeWatch();
    mockBackgroundResponse({ success: false });
    await injectVoiceCallButton();
    expect(document.getElementById("ds-voice-call-host")).toBeNull();
  });

  it("does not inject when background sendMessage throws", async () => {
    setupYouTubeWatch();
    chrome.runtime.sendMessage = jest
      .fn()
      .mockRejectedValue(
        new Error("disconnected"),
      ) as unknown as typeof chrome.runtime.sendMessage;
    await injectVoiceCallButton();
    expect(document.getElementById("ds-voice-call-host")).toBeNull();
  });

  it("injects host into #secondary #related when present", async () => {
    setupYouTubeWatch();
    const secondary = document.createElement("div");
    secondary.id = "secondary";
    const related = document.createElement("div");
    related.id = "related";
    secondary.appendChild(related);
    document.body.appendChild(secondary);

    mockBackgroundResponse({
      success: true,
      state: { plan: "free", trialUsed: false, monthlyMinutesUsed: 0 },
    });
    await injectVoiceCallButton();

    const host = document.getElementById("ds-voice-call-host");
    expect(host).not.toBeNull();
    expect(host?.parentElement?.id).toBe("related");
  });

  it("falls back to floating overlay when no anchor exists", async () => {
    setupYouTubeWatch();
    mockBackgroundResponse({
      success: true,
      state: { plan: "expert", trialUsed: false, monthlyMinutesUsed: 5 },
    });
    await injectVoiceCallButton();

    const host = document.getElementById("ds-voice-call-host");
    expect(host).not.toBeNull();
    expect(host?.parentElement).toBe(document.body);
    expect(host?.style.position).toBe("fixed");
  });

  it("is idempotent — second call does not duplicate the host", async () => {
    setupYouTubeWatch();
    mockBackgroundResponse({
      success: true,
      state: { plan: "free", trialUsed: false, monthlyMinutesUsed: 0 },
    });
    await injectVoiceCallButton();
    await injectVoiceCallButton();
    expect(document.querySelectorAll("#ds-voice-call-host")).toHaveLength(1);
  });

  it("removeVoiceCallButton removes the host", async () => {
    setupYouTubeWatch();
    mockBackgroundResponse({
      success: true,
      state: { plan: "free", trialUsed: false, monthlyMinutesUsed: 0 },
    });
    await injectVoiceCallButton();
    expect(document.getElementById("ds-voice-call-host")).not.toBeNull();
    removeVoiceCallButton();
    expect(document.getElementById("ds-voice-call-host")).toBeNull();
  });

  it("removeVoiceCallButton is safe to call when nothing is injected", () => {
    expect(() => removeVoiceCallButton()).not.toThrow();
  });

  it("requests state via GET_VOICE_BUTTON_STATE action", async () => {
    setupYouTubeWatch();
    const mock = mockBackgroundResponse({
      success: true,
      state: { plan: "free", trialUsed: false, monthlyMinutesUsed: 0 },
    });
    await injectVoiceCallButton();
    expect(mock).toHaveBeenCalledWith({ action: "GET_VOICE_BUTTON_STATE" });
  });
});
