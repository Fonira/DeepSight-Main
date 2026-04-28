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
    expect(screen.getByText(/L'agent commence à écouter/)).toBeInTheDocument();
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

  // ─── V1.2 — Chevron retour ─────────────────────────────────────
  describe("V1.2 chevron retour", () => {
    it("ne rend PAS le chevron retour si onBack n'est pas fourni", () => {
      render(
        <CallActiveView
          elapsedSec={0}
          onMute={jest.fn()}
          onHangup={jest.fn()}
        />,
      );
      expect(screen.queryByTestId("voice-back-btn")).not.toBeInTheDocument();
    });

    it("rend le chevron retour quand onBack est fourni", () => {
      render(
        <CallActiveView
          elapsedSec={0}
          onMute={jest.fn()}
          onHangup={jest.fn()}
          onBack={jest.fn()}
        />,
      );
      const btn = screen.getByTestId("voice-back-btn");
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveTextContent("‹");
      expect(btn).toHaveAttribute("aria-label", "Retour");
    });

    it("appelle onBack au clic sur le chevron", () => {
      const onBack = jest.fn();
      render(
        <CallActiveView
          elapsedSec={0}
          onMute={jest.fn()}
          onHangup={jest.fn()}
          onBack={onBack}
        />,
      );
      fireEvent.click(screen.getByTestId("voice-back-btn"));
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  // ─── V1.2 — Input texte unifié ─────────────────────────────────
  describe("V1.2 input texte unifié", () => {
    it("rend l'input texte avec le placeholder FR", () => {
      render(
        <CallActiveView
          elapsedSec={0}
          onMute={jest.fn()}
          onHangup={jest.fn()}
        />,
      );
      const input = screen.getByTestId("voice-text-input") as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.placeholder).toBe("Tape ou parle…");
      expect(input).not.toBeDisabled();
    });

    it("submit via Enter → appelle onSendTextMessage(text) et clear l'input", () => {
      const onSend = jest.fn();
      render(
        <CallActiveView
          elapsedSec={0}
          onMute={jest.fn()}
          onHangup={jest.fn()}
          onSendTextMessage={onSend}
        />,
      );
      const input = screen.getByTestId("voice-text-input") as HTMLInputElement;
      const form = screen.getByTestId("voice-text-input-form");

      fireEvent.change(input, { target: { value: "Quel est le sujet ?" } });
      expect(input.value).toBe("Quel est le sujet ?");

      fireEvent.submit(form);

      expect(onSend).toHaveBeenCalledWith("Quel est le sujet ?");
      expect(input.value).toBe("");
    });

    it("submit via clic bouton → appelle onSendTextMessage et clear", () => {
      const onSend = jest.fn();
      render(
        <CallActiveView
          elapsedSec={0}
          onMute={jest.fn()}
          onHangup={jest.fn()}
          onSendTextMessage={onSend}
        />,
      );
      const input = screen.getByTestId("voice-text-input") as HTMLInputElement;
      const sendBtn = screen.getByTestId("voice-text-input-send");

      fireEvent.change(input, { target: { value: "Hello" } });
      fireEvent.click(sendBtn);

      expect(onSend).toHaveBeenCalledWith("Hello");
      expect(input.value).toBe("");
    });

    it("trim le texte avant envoi", () => {
      const onSend = jest.fn();
      render(
        <CallActiveView
          elapsedSec={0}
          onMute={jest.fn()}
          onHangup={jest.fn()}
          onSendTextMessage={onSend}
        />,
      );
      const input = screen.getByTestId("voice-text-input") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "  bonjour  " } });
      fireEvent.submit(screen.getByTestId("voice-text-input-form"));
      expect(onSend).toHaveBeenCalledWith("bonjour");
    });

    it("ne soumet pas un texte vide ou whitespace-only", () => {
      const onSend = jest.fn();
      render(
        <CallActiveView
          elapsedSec={0}
          onMute={jest.fn()}
          onHangup={jest.fn()}
          onSendTextMessage={onSend}
        />,
      );
      const input = screen.getByTestId("voice-text-input") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.submit(screen.getByTestId("voice-text-input-form"));
      expect(onSend).not.toHaveBeenCalled();
    });

    it("input et bouton désactivés quand canSendText=false", () => {
      const onSend = jest.fn();
      render(
        <CallActiveView
          elapsedSec={0}
          onMute={jest.fn()}
          onHangup={jest.fn()}
          onSendTextMessage={onSend}
          canSendText={false}
        />,
      );
      const input = screen.getByTestId("voice-text-input") as HTMLInputElement;
      const sendBtn = screen.getByTestId(
        "voice-text-input-send",
      ) as HTMLButtonElement;
      expect(input).toBeDisabled();
      expect(sendBtn).toBeDisabled();
    });

    it("ne déclenche pas onSendTextMessage si canSendText=false même si on bypasse l'UI", () => {
      const onSend = jest.fn();
      render(
        <CallActiveView
          elapsedSec={0}
          onMute={jest.fn()}
          onHangup={jest.fn()}
          onSendTextMessage={onSend}
          canSendText={false}
        />,
      );
      const input = screen.getByTestId("voice-text-input") as HTMLInputElement;
      // input disabled → fireEvent.change ne devrait pas changer la valeur,
      // mais on simule un submit direct du form pour tester la garde.
      fireEvent.change(input, { target: { value: "test" } });
      fireEvent.submit(screen.getByTestId("voice-text-input-form"));
      expect(onSend).not.toHaveBeenCalled();
    });

    it("bouton send disabled quand input vide", () => {
      render(
        <CallActiveView
          elapsedSec={0}
          onMute={jest.fn()}
          onHangup={jest.fn()}
          onSendTextMessage={jest.fn()}
        />,
      );
      const sendBtn = screen.getByTestId(
        "voice-text-input-send",
      ) as HTMLButtonElement;
      expect(sendBtn).toBeDisabled();
    });
  });
});
