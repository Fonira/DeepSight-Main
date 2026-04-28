/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CallActiveView } from "../../../src/sidepanel/components/CallActiveView";
import type { VoiceTranscript } from "../../../src/sidepanel/types";

describe("CallActiveView", () => {
  beforeAll(() => {
    // jsdom ne fournit pas scrollIntoView par défaut → utilisé par
    // VoiceTranscriptList rendu en sous-composant.
    Element.prototype.scrollIntoView = jest.fn();
  });

  it("shows live indicator and elapsed time", () => {
    render(
      <CallActiveView
        elapsedSec={23}
        onMute={jest.fn()}
        onHangup={jest.fn()}
      />,
    );
    expect(screen.getByText(/En appel/)).toBeInTheDocument();
    expect(screen.getByText(/00:23/)).toBeInTheDocument();
  });

  it("renders Mute and Raccrocher buttons", () => {
    render(
      <CallActiveView elapsedSec={0} onMute={jest.fn()} onHangup={jest.fn()} />,
    );
    // aria-label dominate accessible name → on cherche par aria-label FR.
    expect(
      screen.getByRole("button", { name: /Couper le micro/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Terminer l'appel/ }),
    ).toBeInTheDocument();
  });

  it("hangup callback fires on click", () => {
    const onHangup = jest.fn();
    render(
      <CallActiveView elapsedSec={0} onMute={jest.fn()} onHangup={onHangup} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Terminer l'appel/ }));
    expect(onHangup).toHaveBeenCalled();
  });

  it("mute callback fires on click", () => {
    const onMute = jest.fn();
    render(
      <CallActiveView elapsedSec={0} onMute={onMute} onHangup={jest.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Couper le micro/ }));
    expect(onMute).toHaveBeenCalled();
  });

  it("formats elapsed seconds as MM:SS for >60s", () => {
    render(
      <CallActiveView
        elapsedSec={125}
        onMute={jest.fn()}
        onHangup={jest.fn()}
      />,
    );
    expect(screen.getByText(/02:05/)).toBeInTheDocument();
  });

  it("rend VoiceTranscriptList vide par défaut (empty state)", () => {
    render(
      <CallActiveView elapsedSec={0} onMute={jest.fn()} onHangup={jest.fn()} />,
    );
    expect(
      screen.getByText(/L'agent commence à écouter/),
    ).toBeInTheDocument();
  });

  it("rend VoiceTranscriptList avec les transcripts fournis", () => {
    const transcripts: VoiceTranscript[] = [
      { speaker: "user", content: "Salut", ts: 1000 },
      { speaker: "agent", content: "Bonjour !", ts: 2000 },
    ];
    render(
      <CallActiveView
        elapsedSec={0}
        onMute={jest.fn()}
        onHangup={jest.fn()}
        transcripts={transcripts}
      />,
    );
    expect(screen.getByTestId("voice-transcript-user")).toHaveTextContent(
      "Salut",
    );
    expect(screen.getByTestId("voice-transcript-agent")).toHaveTextContent(
      "Bonjour !",
    );
  });
});
