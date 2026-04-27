/** @jest-environment jsdom */
//
// Tests — `renderVoiceCallButton` (extension/src/content/widget.ts)
//
// Couvre :
//  - Rendu du bouton 🎙️ Appeler
//  - Badge dynamique selon plan + trialUsed + monthlyMinutesUsed
//  - Click → envoie OPEN_VOICE_CALL au background
import { renderWidget, getButtons } from "./helpers/widgetHarness";

describe("widget voice call button", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    chrome.runtime.sendMessage = jest.fn();
  });

  it("renders 🎙️ Appeler button", async () => {
    await renderWidget({
      plan: "free",
      trialUsed: false,
      videoId: "abc",
      videoTitle: "Test",
    });
    const btns = getButtons();
    expect(btns).toHaveLength(1);
    expect(btns[0].textContent).toMatch(/Appeler/);
  });

  it("shows '1 essai gratuit' badge for unused free user", async () => {
    await renderWidget({ plan: "free", trialUsed: false, videoId: "abc" });
    expect(document.body.textContent).toContain("1 essai gratuit");
  });

  it("shows 'Essai utilisé' for free user who consumed trial", async () => {
    await renderWidget({ plan: "free", trialUsed: true });
    expect(document.body.textContent).toContain("Essai utilisé");
    const btn = getButtons()[0];
    expect(btn.disabled).toBe(true);
  });

  it("shows minutes remaining for expert user", async () => {
    await renderWidget({ plan: "expert", monthlyMinutesUsed: 10 });
    expect(document.body.textContent).toMatch(/20 min restantes/);
  });

  it("click sends OPEN_VOICE_CALL message to background", async () => {
    await renderWidget({
      plan: "free",
      trialUsed: false,
      videoId: "abc",
      videoTitle: "Test",
    });
    const callBtn = getButtons()[0];
    callBtn.click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "OPEN_VOICE_CALL",
      videoId: "abc",
      videoTitle: "Test",
    });
  });
});
