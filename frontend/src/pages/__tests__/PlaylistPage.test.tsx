import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PlaylistPage from "../PlaylistPage";
import { playlistApi } from "../../services/api";
import type { SmartInputValue } from "../../components/SmartInputBar";

const authState = vi.hoisted(() => ({
  user: null as null | Record<string, unknown>,
  refreshUser: vi.fn(),
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => authState,
}));
vi.mock("../../hooks/useTranslation", () => ({
  useTranslation: () => ({ language: "fr" }),
}));
vi.mock("../../services/api", async () => {
  const actual =
    await vi.importActual<typeof import("../../services/api")>(
      "../../services/api",
    );
  return {
    ...actual,
    videoApi: { discover: vi.fn() },
    playlistApi: {
      getAll: vi.fn(),
      delete: vi.fn(),
      analyze: vi.fn(),
      analyzeCorpus: vi.fn(),
      getStatus: vi.fn(),
    },
  };
});
// Barre de saisie simplifiée : on teste la page, pas SmartInputBar.
vi.mock("../../components/SmartInputBar", () => ({
  default: ({
    value,
    onChange,
    onSubmit,
  }: {
    value: SmartInputValue;
    onChange: (v: SmartInputValue) => void;
    onSubmit: () => void;
  }) => (
    <div>
      <input
        aria-label="playlist-url"
        value={value.url ?? ""}
        onChange={(e) =>
          onChange({ ...value, mode: "url", url: e.target.value })
        }
      />
      <button onClick={onSubmit}>Analyser</button>
    </div>
  ),
}));
vi.mock("../../components/layout/Sidebar", () => ({ Sidebar: () => null }));
vi.mock("../../components/DoodleBackground", () => ({ default: () => null }));
vi.mock("../../components/VideoDiscoveryModal", () => ({
  default: () => null,
}));
vi.mock("../../components/SEO", () => ({ SEO: () => null }));

const api = playlistApi as unknown as Record<string, ReturnType<typeof vi.fn>>;
const PLAYLIST_URL =
  "https://www.youtube.com/playlist?list=PLlaN88a7y2_plecYoJxvRFTLHVbIVAOoc";

function makeUser(plan: string, isAdmin = false) {
  return { id: 1, plan, is_admin: isAdmin, credits: 500, email: "u@test.fr" };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/playlists"]}>
      <Routes>
        <Route path="/playlists" element={<PlaylistPage />} />
        <Route path="/playlist/:id" element={<div>Page détail</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe("PlaylistPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.getAll.mockResolvedValue([]);
  });

  it("shows the upgrade gate to plans without playlists (Free)", () => {
    authState.user = makeUser("free");
    renderPage();
    expect(
      screen.getByText(/Fonctionnalité réservée aux abonnés/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/à partir du plan Pro/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("playlist-url")).not.toBeInTheDocument();
  });

  it("lets the admin in whatever the stored plan, and lists past analyses", async () => {
    authState.user = makeUser("free", true);
    api.getAll.mockResolvedValue([
      {
        id: 12,
        playlist_id: "PLabc",
        playlist_title: "Cours de philo",
        num_videos: 4,
        num_processed: 4,
        status: "completed",
        created_at: "2026-11-20T10:00:00",
      },
    ]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Cours de philo")).toBeInTheDocument();
    expect(screen.getByText(/4\/4/)).toBeInTheDocument();
    await user.click(screen.getByText("Cours de philo"));
    expect(await screen.findByText("Page détail")).toBeInTheDocument();
  });

  it("caps the video count options to the plan limit (Expert = 20)", async () => {
    authState.user = makeUser("expert");
    renderPage();
    await waitFor(() => expect(api.getAll).toHaveBeenCalled());
    const options = screen
      .getAllByRole("option")
      .map((o) => Number((o as HTMLOptionElement).value));
    expect(options).toEqual([5, 10, 15, 20]);
  });

  it("launches an analysis, polls it and opens the detail page", async () => {
    authState.user = makeUser("expert");
    api.analyze.mockResolvedValue({ task_id: "task-1", status: "pending" });
    api.getStatus.mockResolvedValue({
      task_id: "task-1",
      status: "completed",
      progress: 100,
      current_video: 3,
      completed_videos: 3,
      total_videos: 3,
      playlist_title: "Cours de philo",
      result: {
        playlist_id: "PLlaN88a7y2_plecYoJxvRFTLHVbIVAOoc",
        num_videos: 3,
      },
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("playlist-url"), PLAYLIST_URL);
    await user.click(screen.getByText("Analyser"));

    await waitFor(() =>
      expect(api.analyze).toHaveBeenCalledWith(PLAYLIST_URL, {
        maxVideos: 10,
        mode: "accessible",
        lang: "fr",
      }),
    );
    expect(api.getStatus).toHaveBeenCalledWith("task-1");
    expect(
      await screen.findByText(/3 vidéos analysées avec succès/),
    ).toBeInTheDocument();
    expect(authState.refreshUser).toHaveBeenCalled();

    await user.click(screen.getByText("Voir les détails & outils"));
    expect(await screen.findByText("Page détail")).toBeInTheDocument();
  });

  it("shows the server error when the analysis fails", async () => {
    authState.user = makeUser("expert");
    api.analyze.mockResolvedValue({ task_id: "task-2", status: "pending" });
    api.getStatus.mockResolvedValue({
      task_id: "task-2",
      status: "failed",
      message: "Aucune vidéo trouvée dans la playlist",
      error: "Aucune vidéo trouvée dans la playlist",
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("playlist-url"), PLAYLIST_URL);
    await user.click(screen.getByText("Analyser"));

    expect(
      await screen.findByText("Aucune vidéo trouvée dans la playlist"),
    ).toBeInTheDocument();
  });

  it("rejects a URL that is not a playlist without calling the API", async () => {
    authState.user = makeUser("expert");
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText("playlist-url"),
      "https://www.youtube.com/watch?v=aaaaaaaaaaa",
    );
    await user.click(screen.getByText("Analyser"));

    expect(
      await screen.findByText(/URL de playlist invalide/),
    ).toBeInTheDocument();
    expect(api.analyze).not.toHaveBeenCalled();
  });
});
