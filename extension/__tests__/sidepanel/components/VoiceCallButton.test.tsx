/** @jest-environment jsdom */
//
// Tests — VoiceCallButton (wrapper React du DOM widget renderVoiceCallButton)
//
// Couvre :
//  - rendu du bouton dans le wrapper si videoId fourni
//  - badge dynamique selon plan (free / expert)
//  - pas de rendu si videoId absent
//  - re-render quand props changent (idempotence)
//  - click envoie OPEN_VOICE_CALL au background

import React from "react";
import { render, screen } from "@testing-library/react";
import { VoiceCallButton } from "../../../src/sidepanel/components/VoiceCallButton";

describe("VoiceCallButton", () => {
  beforeEach(() => {
    chrome.runtime.sendMessage = jest.fn();
  });

  it("renders the 🎙️ button when videoId is provided", () => {
    render(
      <VoiceCallButton
        plan="free"
        trialUsed={false}
        videoId="abc"
        videoTitle="Hello"
      />,
    );
    const btn = document.querySelector("button.ds-voice-call-btn");
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toMatch(/Appeler/);
  });

  it("shows '1 essai gratuit' badge for unused free user", () => {
    render(<VoiceCallButton plan="free" trialUsed={false} videoId="abc" />);
    expect(document.body.textContent).toContain("1 essai gratuit");
  });

  it("disables the button for free user who consumed trial", () => {
    render(<VoiceCallButton plan="free" trialUsed={true} videoId="abc" />);
    const btn = document.querySelector(
      "button.ds-voice-call-btn",
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

  it("renders nothing when videoId is missing", () => {
    render(<VoiceCallButton plan="free" />);
    expect(document.querySelector("button.ds-voice-call-btn")).toBeNull();
  });

  it("re-renders idempotently when props change (no duplicate buttons)", () => {
    const { rerender } = render(
      <VoiceCallButton plan="free" trialUsed={false} videoId="abc" />,
    );
    expect(document.querySelectorAll("button.ds-voice-call-btn")).toHaveLength(
      1,
    );
    rerender(<VoiceCallButton plan="free" trialUsed={true} videoId="abc" />);
    expect(document.querySelectorAll("button.ds-voice-call-btn")).toHaveLength(
      1,
    );
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
      "button.ds-voice-call-btn",
    ) as HTMLButtonElement;
    btn.click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "OPEN_VOICE_CALL",
      videoId: "abc123",
      videoTitle: "Test Title",
    });
  });

  // Sanity: even when rendered, screen tooling should still see the wrapper
  it("attaches a wrapper div with the conventional class", () => {
    render(<VoiceCallButton plan="pro" videoId="abc" />);
    expect(
      document.querySelector(".ds-voice-call-button-wrapper"),
    ).not.toBeNull();
    // Pro has no specific badge in widget.ts current impl — just the base label
    expect(screen.getByRole("button").textContent).toMatch(/Appeler/);
  });
});
