/**
 * VoiceCallButton.test.tsx — Tests for the header variant of the
 * voice "Appeler" button.
 *
 * The header variant is rendered in ChatPage and is bigger (h-12),
 * carries an ElevenLabs logo on the left and a violet→blue gradient
 * background. It also exposes an "active" mode used while a call is
 * in progress (label switches to "Raccrocher").
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { VoiceCallButton } from "../VoiceCallButton";

describe("VoiceCallButton (header variant)", () => {
  it("renders the call label with the ElevenLabs logo by default", () => {
    render(
      <VoiceCallButton
        variant="header"
        active={false}
        onClick={() => {}}
        label="Appeler"
        endLabel="Raccrocher"
      />,
    );
    const button = screen.getByRole("button", { name: /appeler/i });
    expect(button).toBeDefined();
    // ElevenLabs logo is rendered as an SVG identified by its aria-label.
    const logo = button.querySelector("svg[aria-label='ElevenLabs']");
    expect(logo).not.toBeNull();
  });

  it("uses h-12 + px-5 sizing for the header variant (bigger button)", () => {
    render(
      <VoiceCallButton
        variant="header"
        active={false}
        onClick={() => {}}
        label="Appeler"
        endLabel="Raccrocher"
      />,
    );
    const button = screen.getByRole("button");
    expect(button.className).toContain("h-12");
    expect(button.className).toContain("px-5");
  });

  it("uses the violet→blue gradient when not active", () => {
    render(
      <VoiceCallButton
        variant="header"
        active={false}
        onClick={() => {}}
        label="Appeler"
        endLabel="Raccrocher"
      />,
    );
    const button = screen.getByRole("button");
    // The visual identity for voice = violet, gradient → blue.
    expect(button.className).toContain("from-violet-500");
    expect(button.className).toContain("to-blue-500");
  });

  it("shows the end-call label in active state", () => {
    render(
      <VoiceCallButton
        variant="header"
        active={true}
        onClick={() => {}}
        label="Appeler"
        endLabel="Raccrocher"
      />,
    );
    const button = screen.getByRole("button", { name: /raccrocher/i });
    expect(button).toBeDefined();
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("calls onClick when pressed", () => {
    const onClick = vi.fn();
    render(
      <VoiceCallButton
        variant="header"
        active={false}
        onClick={onClick}
        label="Appeler"
        endLabel="Raccrocher"
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <VoiceCallButton
        variant="header"
        active={false}
        onClick={onClick}
        disabled
        label="Appeler"
        endLabel="Raccrocher"
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("matches the snapshot for the header variant rendering", () => {
    const { container } = render(
      <VoiceCallButton
        variant="header"
        active={false}
        onClick={() => {}}
        label="Appeler"
        endLabel="Raccrocher"
        testId="chat-page-voice-toggle"
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
