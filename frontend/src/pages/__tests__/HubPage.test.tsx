// frontend/src/pages/__tests__/HubPage.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HubPage from "../HubPage";
import { useHubStore } from "../../store/hubStore";

vi.mock("../../services/api", () => ({
  videoApi: {
    getHistory: vi.fn().mockResolvedValue({ items: [] }),
  },
  chatApi: {
    getHistory: vi.fn().mockResolvedValue([]),
    send: vi.fn(),
  },
  voiceApi: {
    appendTranscript: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { plan: "pro", preferences: { has_completed_onboarding: true } },
    loading: false,
  }),
}));

vi.mock("../../hooks/useTranslation", () => ({
  useTranslation: () => ({ language: "fr", t: { empty_states: {} } }),
}));

vi.mock("../../components/voice/VoiceOverlay", () => ({
  VoiceOverlay: () => null,
}));

vi.mock("../../components/voice/hooks/useVoiceEnabled", () => ({
  useVoiceEnabled: () => ({ voiceEnabled: true }),
}));

vi.mock("../../contexts/TTSContext", () => ({
  useTTSContext: () => ({
    autoPlayEnabled: false,
    playText: vi.fn(),
    stopPlaying: vi.fn(),
  }),
}));

// DoodleBackground uses useTheme() which throws outside ThemeProvider — mock it.
vi.mock("../../components/DoodleBackground", () => ({
  default: () => null,
}));

// SEO uses react-helmet-async which complains without HelmetProvider — mock it.
vi.mock("../../components/SEO", () => ({
  SEO: () => null,
}));

// useAnalyzeAndOpenHub calls useBackgroundAnalysis which throws outside its
// provider — mock the hook to keep the test focused on rendering.
vi.mock("../../hooks/useAnalyzeAndOpenHub", () => ({
  default: () => ({
    analyzeAndOpenHub: vi.fn(),
    isAnalyzing: false,
  }),
  useAnalyzeAndOpenHub: () => ({
    analyzeAndOpenHub: vi.fn(),
    isAnalyzing: false,
  }),
}));

// Many child components call useBackgroundAnalysis (NewConversationModal,
// useAnalyzeAndOpenHub, BackgroundAnalysisPanel) — mock the whole module.
vi.mock("../../contexts/BackgroundAnalysisContext", () => ({
  BackgroundAnalysisProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useBackgroundAnalysis: () => ({
    startVideoAnalysis: vi.fn(),
    cancelAnalysis: vi.fn(),
    activeAnalyses: [],
    completedAnalyses: [],
    failedAnalyses: [],
    isAnyAnalysisRunning: false,
  }),
  default: null,
}));

// HubHeader and other components call useAuthContext directly — mock it.
vi.mock("../../contexts/AuthContext", async () => {
  const actual = await vi.importActual<
    typeof import("../../contexts/AuthContext")
  >("../../contexts/AuthContext");
  return {
    ...actual,
    useAuthContext: () => ({
      user: {
        id: 1,
        email: "test@test.com",
        plan: "pro",
        preferences: { has_completed_onboarding: true },
      },
      loading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      loginWithGoogle: vi.fn(),
    }),
  };
});

beforeEach(() => {
  useHubStore.getState().reset();
});

describe("HubPage", () => {
  it("renders empty state when no conversation is active", async () => {
    render(
      <MemoryRouter initialEntries={["/hub"]}>
        <HubPage />
      </MemoryRouter>,
    );
    // When activeConvId is null, HubPage renders <NoConvPlaceholder>
    // with the copy "Aucune conversation sélectionnée".
    await waitFor(() =>
      expect(
        screen.getByText(/aucune conversation sélectionnée/i),
      ).toBeInTheDocument(),
    );
  });

  it("renders the open-list button in the empty state", async () => {
    render(
      <MemoryRouter initialEntries={["/hub"]}>
        <HubPage />
      </MemoryRouter>,
    );
    // The InputBar is hidden until a conversation is active. The empty state
    // exposes "Ouvrir la liste" instead.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /ouvrir la liste/i }),
      ).toBeInTheDocument(),
    );
  });
});
