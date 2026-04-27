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

import React from "react";
import { render, screen } from "@testing-library/react";
import { VoiceCallButton } from "../../../src/sidepanel/components/VoiceCallButton";

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

  it("shows upgrade CTA badge for pro plan", () => {
    render(<VoiceCallButton plan="pro" videoId="abc" />);
    expect(document.body.textContent).toContain("Passer en Expert");
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
    const btn = screen.getByRole("button") as HTMLButtonElement;
    btn.click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "OPEN_VOICE_CALL",
      videoId: "abc123",
      videoTitle: "Test Title",
    });
  });

  it("disabled button does not send message on click", () => {
    render(<VoiceCallButton plan="free" trialUsed={true} videoId="abc" />);
    const btn = screen.getByRole("button") as HTMLButtonElement;
    btn.click();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
});
