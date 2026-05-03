/**
 * 🎓 Le Tuteur — Tests du composant racine Tutor.
 *
 * Vérifie la composition state machine : idle render, prompting on click,
 * mini-chat on text mode start.
 *
 * On mock useLoadingWord/useLanguage/useAuth pour éviter le fetch réel
 * du LoadingWordProvider et la dépendance au localStorage des autres providers.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Tutor } from "../Tutor";

vi.mock("../../../services/api", () => ({
  tutorApi: {
    startSession: vi.fn().mockResolvedValue({
      session_id: "tutor-test123",
      first_prompt: "Comment l'expliqueriez-vous ?",
      audio_url: null,
    }),
    sendTurn: vi.fn().mockResolvedValue({
      ai_response: "Très bien.",
      audio_url: null,
      turn_count: 3,
    }),
    endSession: vi.fn().mockResolvedValue({
      duration_sec: 30,
      turns_count: 3,
      source_summary_url: null,
      source_video_title: null,
    }),
  },
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { plan: "pro" },
  }),
  default: () => ({
    isAuthenticated: true,
    user: { plan: "pro" },
  }),
}));

vi.mock("../../../contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "fr",
    setLanguage: vi.fn(),
    t: (k: string) => k,
  }),
}));

vi.mock("../../../contexts/LoadingWordContext", () => ({
  useLoadingWord: () => ({
    currentWord: {
      term: "Rasoir d'Occam",
      definition: "Principe de parcimonie épistémologique.",
      shortDefinition: "Principe de parcimonie.",
      category: "philosophy",
      source: "history" as const,
      summaryId: 42,
      videoTitle: "Vidéo test",
    },
    isLoading: false,
    error: null,
    refreshWord: vi.fn(),
    nextWord: vi.fn(),
    injectConcepts: vi.fn(),
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
    isTimerActive: false,
    hasHistory: true,
    isWidgetVisible: false,
    toggleWidget: vi.fn(),
    isSidebarVisible: false,
    toggleSidebar: vi.fn(),
    userCategories: [],
    historyCount: 1,
    getWordByFilter: vi.fn(),
    getRecentTerms: vi.fn(),
  }),
}));

describe("Tutor (composant racine)", () => {
  it("renders idle state by default", async () => {
    render(<Tutor />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Ouvrir le Tuteur/i)).toBeInTheDocument();
    });
  });

  it("transitions to prompting on click idle", async () => {
    render(<Tutor />);
    const idleButton = await screen.findByLabelText(/Ouvrir le Tuteur/i);
    fireEvent.click(idleButton);
    await waitFor(() => {
      expect(screen.getByText(/On en parle/i)).toBeInTheDocument();
    });
  });

  it("transitions to mini-chat on text mode", async () => {
    render(<Tutor />);
    const idleButton = await screen.findByLabelText(/Ouvrir le Tuteur/i);
    fireEvent.click(idleButton);
    const textBtn = await screen.findByText("Texte");
    fireEvent.click(textBtn);
    await waitFor(() => {
      expect(
        screen.getByText("Comment l'expliqueriez-vous ?"),
      ).toBeInTheDocument();
    });
  });
});
