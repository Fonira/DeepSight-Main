/** @jest-environment jsdom */
//
// Tests — VoiceCallButton (composant React natif "Appel rapide")
//
// Couvre :
//  - rendu du bouton avec class voice-call-btn quand videoId fourni
//  - texte "🎙️ Appel rapide" et badge dynamique selon plan
//  - bouton désactivé si free + trialUsed
//  - rendu nul si videoId absent
//  - click envoie OPEN_VOICE_CALL au background
//  - v1.2 : bouton ⚙ pré-call, layout flex-row, ouverture VoiceSettingsDrawer

import React from "react";
import { act, render, screen } from "@testing-library/react";
import { VoiceCallButton } from "../../../src/sidepanel/components/VoiceCallButton";

// On mocke useVoiceSettings pour éviter tout fetch réseau parasite au mount
// (le hook réel appelle chrome.runtime.sendMessage avec
// VOICE_GET_PREFERENCES / VOICE_GET_CATALOG, ce qui pollue les assertions
// "click sends OPEN_VOICE_CALL").
jest.mock("../../../src/sidepanel/useVoiceSettings", () => ({
  useVoiceSettings: jest.fn(() => ({
    prefs: null,
    effectivePrefs: null,
    catalog: null,
    loading: false,
    error: null,
    saving: false,
    stagedFields: {},
    stagedCount: 0,
    setLive: jest.fn(),
    setStaged: jest.fn(),
    applyStaged: jest.fn(async () => ({})),
    resetStaged: jest.fn(),
    resetToDefaults: jest.fn(async () => undefined),
    reload: jest.fn(async () => undefined),
  })),
  HARD_FIELDS: [
    "voice_id",
    "voice_name",
    "tts_model",
    "voice_chat_model",
    "stability",
    "similarity_boost",
    "style",
    "use_speaker_boost",
    "gender",
    "language",
    "speed",
    "voice_chat_speed_preset",
  ],
}));

describe("VoiceCallButton", () => {
  beforeEach(() => {
    chrome.runtime.sendMessage = jest
      .fn()
      .mockResolvedValue(
        undefined,
      ) as unknown as typeof chrome.runtime.sendMessage;
  });

  it("renders the 🎙️ Appel rapide button when videoId is provided", () => {
    render(
      <VoiceCallButton
        plan="free"
        trialUsed={false}
        videoId="abc"
        videoTitle="Hello"
      />,
    );
    const btn = document.querySelector(
      "button.voice-call-btn",
    ) as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toMatch(/Appel rapide/);
  });

  it("shows '1 essai gratuit' badge for unused free user", () => {
    render(<VoiceCallButton plan="free" trialUsed={false} videoId="abc" />);
    expect(document.body.textContent).toContain("1 essai gratuit");
  });

  it("disables the button for free user who consumed trial", () => {
    render(<VoiceCallButton plan="free" trialUsed={true} videoId="abc" />);
    const btn = document.querySelector(
      "button.voice-call-btn",
    ) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
    expect(document.body.textContent).toContain("Essai utilisé");
  });

  it("shows minutes remaining for expert plan", () => {
    render(
      <VoiceCallButton plan="expert" monthlyMinutesUsed={5} videoId="abc" />,
    );
    expect(document.body.textContent).toMatch(/25 min restantes/);
  });

  it("shows minutes remaining for pro plan", () => {
    render(<VoiceCallButton plan="pro" monthlyMinutesUsed={0} videoId="abc" />);
    expect(document.body.textContent).toMatch(/30 min restantes/);
  });

  it("renders nothing when videoId is missing", () => {
    const { container } = render(<VoiceCallButton plan="free" />);
    expect(container.querySelector("button.voice-call-btn")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("re-renders idempotently when props change (no duplicate buttons)", () => {
    const { rerender } = render(
      <VoiceCallButton plan="free" trialUsed={false} videoId="abc" />,
    );
    expect(document.querySelectorAll("button.voice-call-btn")).toHaveLength(1);
    rerender(<VoiceCallButton plan="free" trialUsed={true} videoId="abc" />);
    expect(document.querySelectorAll("button.voice-call-btn")).toHaveLength(1);
    expect(document.body.textContent).toContain("Essai utilisé");
  });

  it("click sends OPEN_VOICE_CALL message to background", () => {
    render(
      <VoiceCallButton
        plan="free"
        trialUsed={false}
        videoId="abc123"
        videoTitle="Test Title"
      />,
    );
    const btn = document.querySelector(
      "button.voice-call-btn",
    ) as HTMLButtonElement;
    btn.click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "OPEN_VOICE_CALL",
      videoId: "abc123",
      videoTitle: "Test Title",
      plan: "free", // [N3] propagation du plan pour PostHog.
    });
  });

  it("disabled button does not send message on click", () => {
    render(<VoiceCallButton plan="free" trialUsed={true} videoId="abc" />);
    const btn = document.querySelector(
      "button.voice-call-btn",
    ) as HTMLButtonElement;
    btn.click();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  // ── v1.2 — bouton ⚙ pré-call ─────────────────────────────────────────

  it("renders a ⚙ settings button next to the CTA when videoId is provided", () => {
    render(<VoiceCallButton plan="free" trialUsed={false} videoId="abc" />);
    const settingsBtn = screen.getByTestId("voice-settings-btn-precall");
    expect(settingsBtn).not.toBeNull();
    expect(settingsBtn.getAttribute("aria-label")).toBe("Réglages voix");
    // Le bouton a la classe CSS attendue (32×32, fond translucide).
    expect(settingsBtn.classList.contains("dsp-voice-settings-btn")).toBe(true);
  });

  it("does NOT render the ⚙ settings button when videoId is missing", () => {
    render(<VoiceCallButton plan="free" />);
    expect(
      document.querySelector('[data-testid="voice-settings-btn-precall"]'),
    ).toBeNull();
  });

  it("places the CTA and ⚙ in a flex row container (visual layout)", () => {
    render(<VoiceCallButton plan="pro" videoId="abc" />);
    const row = document.querySelector(".voice-call-row");
    expect(row).not.toBeNull();
    // Le CTA et le ⚙ sont enfants directs de la rangée.
    expect(row?.querySelector("button.voice-call-btn")).not.toBeNull();
    expect(
      row?.querySelector('[data-testid="voice-settings-btn-precall"]'),
    ).not.toBeNull();
  });

  it("clicking ⚙ opens the VoiceSettingsDrawer (aria-hidden=false)", () => {
    render(<VoiceCallButton plan="pro" videoId="abc" />);
    const drawer = document.querySelector(
      '[role="dialog"][aria-label="Réglages voix"]',
    ) as HTMLElement | null;
    expect(drawer).not.toBeNull();
    // Initialement fermé.
    expect(drawer?.getAttribute("aria-hidden")).toBe("true");

    const settingsBtn = screen.getByTestId("voice-settings-btn-precall");
    act(() => {
      settingsBtn.click();
    });

    expect(drawer?.getAttribute("aria-hidden")).toBe("false");
    expect(drawer?.classList.contains("is-open")).toBe(true);
  });

  it("clicking ⚙ does NOT trigger OPEN_VOICE_CALL", () => {
    render(<VoiceCallButton plan="pro" videoId="abc" />);
    const settingsBtn = screen.getByTestId("voice-settings-btn-precall");
    act(() => {
      settingsBtn.click();
    });
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
});
