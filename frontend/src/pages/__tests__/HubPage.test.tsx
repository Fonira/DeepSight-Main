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
    await waitFor(() =>
      expect(
        screen.getByText(/posez votre première question/i),
      ).toBeInTheDocument(),
    );
  });

  it("renders the InputBar at the bottom", async () => {
    render(
      <MemoryRouter initialEntries={["/hub"]}>
        <HubPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText(/posez votre question/i),
      ).toBeInTheDocument(),
    );
  });
});
