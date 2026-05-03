import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Tutor } from "../Tutor";

// jsdom n'implémente pas Element.scrollTo — TutorMiniChat utilise scrollRef.current?.scrollTo
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

vi.mock("../../../services/api", () => ({
  tutorApi: {
    sessionStart: vi.fn().mockResolvedValue({
      session_id: "tutor-test123",
      first_prompt: "Comment l'expliqueriez-vous ?",
      audio_url: null,
    }),
    sessionTurn: vi.fn().mockResolvedValue({
      ai_response: "Très bien.",
      audio_url: null,
      turn_count: 3,
    }),
    sessionEnd: vi.fn().mockResolvedValue({
      duration_sec: 30,
      turns_count: 3,
      source_summary_url: null,
      source_video_title: null,
    }),
  },
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { plan: "pro" } }),
}));

vi.mock("../../../contexts/LoadingWordContext", () => ({
  useLoadingWord: () => ({
    currentWord: {
      term: "Rasoir d'Occam",
      definition: "Principe de parcimonie...",
      shortDefinition: "Le plus simple est le plus probable.",
      summaryId: 42,
      videoTitle: "Test Video",
    },
  }),
}));

vi.mock("../../../contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "fr" }),
}));

vi.mock("../../../hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: {
      tutor: {
        title: "Le Tuteur",
        idle: { hint: "Cliquez pour dialoguer" },
        prompting: {
          ask: "On en parle ?",
          mode_text: "Texte",
          mode_text_duration: "30s",
          mode_voice: "Voix",
          mode_voice_duration: "5min",
          back: "Annuler",
        },
        mini_chat: {
          input_placeholder: "Tapez votre réponse...",
          deepen: "Approfondir",
          close: "Fermer",
        },
        deep_session: {
          pause: "Pause",
          switch_to_text: "Texte",
          end: "Fin",
          source_link: "Voir l'analyse source",
        },
        errors: {
          session_failed: "Session impossible — réessayez",
          plan_required: "Disponible avec Pro ou Expert",
          voice_unavailable: "Voix indisponible",
        },
      },
    },
    language: "fr",
  }),
}));

const renderTutor = () => render(<Tutor />);

describe("Tutor (composant racine)", () => {
  it("renders idle state by default", () => {
    renderTutor();
    expect(screen.getByLabelText(/Ouvrir le Tuteur/i)).toBeInTheDocument();
  });

  it("transitions to prompting on click idle", () => {
    renderTutor();
    fireEvent.click(screen.getByLabelText(/Ouvrir le Tuteur/i));
    expect(screen.getByText(/On en parle/i)).toBeInTheDocument();
  });

  it("transitions to mini-chat on text mode", async () => {
    renderTutor();
    fireEvent.click(screen.getByLabelText(/Ouvrir le Tuteur/i));
    fireEvent.click(screen.getByText("Texte"));
    await waitFor(() => {
      expect(
        screen.getByText("Comment l'expliqueriez-vous ?"),
      ).toBeInTheDocument();
    });
  });
});
