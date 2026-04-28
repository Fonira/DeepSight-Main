/** @jest-environment jsdom */
//
// Tests — VoiceTranscriptList (extension/src/sidepanel/components/VoiceTranscriptList.tsx)
//
// Vérifie :
//   1. Empty state quand transcripts=[]
//   2. Rendu user + agent avec icônes correctes + ordre préservé
//   3. Auto-scroll : scrollIntoView appelé sur le sentinel bottom à chaque
//      arrivée de nouveau transcript (re-render avec array plus long).
import React from "react";
import { render, screen } from "@testing-library/react";
import { VoiceTranscriptList } from "../../../src/sidepanel/components/VoiceTranscriptList";
import type { VoiceTranscript } from "../../../src/sidepanel/types";

describe("VoiceTranscriptList", () => {
  beforeAll(() => {
    // jsdom ne fournit pas scrollIntoView par défaut.
    Element.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
  });

  it("affiche l'empty state quand transcripts est vide", () => {
    render(<VoiceTranscriptList transcripts={[]} />);
    expect(screen.getByText(/L'agent commence à écouter/)).toBeInTheDocument();
    expect(
      screen.getByRole("log", { name: /Transcription de l'appel/ }),
    ).toBeInTheDocument();
  });

  it("rend user + agent avec icônes correctes et préserve l'ordre", () => {
    const transcripts: VoiceTranscript[] = [
      { speaker: "user", content: "Salut, c'est quoi le sujet ?", ts: 1000 },
      { speaker: "agent", content: "On parle d'IA générative.", ts: 2000 },
    ];
    render(<VoiceTranscriptList transcripts={transcripts} />);

    const userMsg = screen.getByTestId("voice-transcript-user");
    const agentMsg = screen.getByTestId("voice-transcript-agent");

    expect(userMsg).toHaveTextContent("👤");
    expect(userMsg).toHaveTextContent("Salut, c'est quoi le sujet ?");
    expect(agentMsg).toHaveTextContent("🤖");
    expect(agentMsg).toHaveTextContent("On parle d'IA générative.");

    // Ordre préservé : user avant agent dans le DOM.
    expect(
      userMsg.compareDocumentPosition(agentMsg) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Empty state absent.
    expect(
      screen.queryByText(/L'agent commence à écouter/),
    ).not.toBeInTheDocument();
  });

  it("appelle scrollIntoView sur le sentinel à chaque nouveau message", () => {
    const initial: VoiceTranscript[] = [
      { speaker: "user", content: "Premier", ts: 1000 },
    ];
    const { rerender } = render(<VoiceTranscriptList transcripts={initial} />);

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);

    const updated: VoiceTranscript[] = [
      ...initial,
      { speaker: "agent", content: "Réponse", ts: 2000 },
    ];
    rerender(<VoiceTranscriptList transcripts={updated} />);

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2);
    // Vérifie le mode smooth/end (option par défaut du composant).
    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({
      behavior: "smooth",
      block: "end",
    });
  });

  it("attribue les bonnes classes alignement user/agent", () => {
    const transcripts: VoiceTranscript[] = [
      { speaker: "user", content: "U", ts: 1 },
      { speaker: "agent", content: "A", ts: 2 },
    ];
    render(<VoiceTranscriptList transcripts={transcripts} />);
    const user = screen.getByTestId("voice-transcript-user");
    const agent = screen.getByTestId("voice-transcript-agent");
    expect(user.className).toContain("ds-voice-transcript-msg--user");
    expect(agent.className).toContain("ds-voice-transcript-msg--agent");
  });
});
