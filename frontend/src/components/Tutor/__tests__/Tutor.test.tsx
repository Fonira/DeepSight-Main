import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Tutor } from "../Tutor";
import { useTutorStore } from "../../../store/tutorStore";

// jsdom n'implémente pas Element.scrollTo — TutorHub utilise scrollRef.current?.scrollTo
beforeAll(() => {
  Element.prototype.scrollTo =
    vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

// Stub VoiceOverlay to avoid pulling in ElevenLabs SDK in tests.
vi.mock("../../voice/VoiceOverlay", () => ({
  VoiceOverlay: () => null,
}));

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

vi.mock("../../../contexts/LanguageContext", async () => {
  // Need a real React.Context so TutorHub's `useContext(LanguageContext)` works.
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    useLanguage: () => ({ language: "fr" }),
    LanguageContext: React.createContext<{ language: "fr" | "en" } | undefined>(
      undefined,
    ),
  };
});

vi.mock("../../../hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: {
      tutor: {
        title: "Le Tuteur",
        idle: { hint: "Cliquez pour dialoguer" },
        mini_chat: {
          input_placeholder: "Tapez votre réponse...",
          close: "Fermer",
          minimize: "Réduire",
          expand: "Agrandir",
        },
        errors: {
          session_failed: "Session impossible — réessayez",
          plan_required: "Disponible avec Pro ou Expert",
        },
      },
    },
    language: "fr",
  }),
}));

const renderTutor = () =>
  render(
    <MemoryRouter>
      <Tutor />
    </MemoryRouter>,
  );

describe("Tutor (composant racine)", () => {
  beforeEach(() => {
    localStorage.clear();
    useTutorStore.getState().reset();
  });

  it("renders the idle teaser by default", () => {
    renderTutor();
    expect(screen.getByLabelText(/Ouvrir le Tuteur/i)).toBeInTheDocument();
  });

  it("opens the TutorHub on teaser click (with concept amorce)", async () => {
    renderTutor();
    fireEvent.click(screen.getByLabelText(/Ouvrir le Tuteur/i));
    await waitFor(() => {
      // Hub dialogue rendered via portal (data-testid="tutor-hub").
      expect(screen.getByTestId("tutor-hub")).toBeInTheDocument();
    });
  });

  it("does NOT render the old TutorPrompting screen anymore", async () => {
    renderTutor();
    fireEvent.click(screen.getByLabelText(/Ouvrir le Tuteur/i));
    // "Discuter" was the prompting CTA — it must be gone.
    await waitFor(() => {
      expect(screen.getByTestId("tutor-hub")).toBeInTheDocument();
    });
    expect(screen.queryByText("Discuter")).not.toBeInTheDocument();
  });

  it("respects ds-tutor-hidden=true → ne render rien", () => {
    localStorage.setItem("ds-tutor-hidden", "true");
    const { container } = renderTutor();
    expect(container.firstChild).toBeNull();
  });

  it("respects ds-tutor-minimized=true → render la pastille", () => {
    localStorage.setItem("ds-tutor-minimized", "true");
    renderTutor();
    expect(screen.getByLabelText(/Agrandir/i)).toBeInTheDocument();
  });

  it("clic minimize → passe en pastille (LS sauvé)", async () => {
    renderTutor();
    fireEvent.click(screen.getByLabelText(/Réduire/i));
    await waitFor(() => {
      expect(screen.getByLabelText(/Agrandir/i)).toBeInTheDocument();
    });
    expect(localStorage.getItem("ds-tutor-minimized")).toBe("true");
  });

  it("clic close → cache + LS sauvé", async () => {
    const { container } = renderTutor();
    const closeBtn = screen.getByLabelText(/^Fermer$/i);
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
    expect(localStorage.getItem("ds-tutor-hidden")).toBe("true");
  });
});
