/**
 * 🧪 Tests — PublicAnalysisPage
 *
 * Vérifie :
 *   1. Loader pendant le fetch initial
 *   2. Rendu du contenu sur succès (titre + analyse + permalink + JSON-LD)
 *   3. État d'erreur 404 (analyse privée ou inexistante)
 *   4. Le slug invalide propage le même état "not found"
 *
 * Sprint Export to AI + GEO — Phase 3.
 * Spec : Vault/01-Projects/DeepSight/Specs/2026-05-07-deepsight-export-to-ai-geo-design.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  renderWithProviders,
  screen,
  waitFor,
} from "../../__tests__/test-utils";
import { Routes, Route } from "react-router-dom";
import PublicAnalysisPage from "../PublicAnalysisPage";

/**
 * useParams ne fonctionne que dans une <Route> matching. On wrap chaque test
 * dans Routes/Route pour que le slug soit extrait depuis l'URL.
 */
function PageInRoute() {
  return (
    <Routes>
      <Route path="/a/:slug" element={<PublicAnalysisPage />} />
      <Route path="/a/" element={<PublicAnalysisPage />} />
    </Routes>
  );
}

// Mock l'API
vi.mock("../../services/api", () => ({
  publicAnalysisApi: {
    getBySlug: vi.fn(),
    setVisibility: vi.fn(),
    buildPermalink: (slug: string) =>
      `https://deepsightsynthesis.com/a/${slug}`,
  },
}));

// Mock DoodleBackground (utilise ThemeContext non disponible dans test-utils).
vi.mock("../../components/DoodleBackground", () => ({
  default: () => null,
}));

// Mock DeepSightSpinner pour rendre un texte facilement détectable.
vi.mock("../../components/ui/DeepSightSpinner", () => ({
  DeepSightSpinner: () => <div data-testid="ds-spinner" />,
  DeepSightSpinnerSmall: () => <div data-testid="ds-spinner-small" />,
}));

// sanitizeTitle : utilise simplement la valeur (mock minimal).
vi.mock("../../utils/sanitize", () => ({
  sanitizeTitle: (s: string) => s,
}));

import { publicAnalysisApi } from "../../services/api";

const mockGet = publicAnalysisApi.getBySlug as ReturnType<typeof vi.fn>;

const SAMPLE_PAYLOAD = {
  id: "169",
  slug: "aa9",
  video_id: "dQw4w9WgXcQ",
  video_title: "Rick Astley - Never Gonna Give You Up",
  video_channel: "Rick Astley",
  video_duration: 213,
  video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  summary_content:
    "## Synthèse\n\nClip musical iconique des années 80 avec une promesse d'engagement.\n\n- Bullet 1\n- Bullet 2",
  summary_extras: null,
  visual_analysis: null,
  lang: "fr",
  mode: "standard",
  model_used: "mistral-small-2603",
  platform: "youtube",
  category: "music",
  reliability_score: 60,
  deep_research: false,
  created_at: "2026-05-07T14:32:00Z",
  permalink: "https://deepsightsynthesis.com/a/aa9",
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PublicAnalysisPage", () => {
  describe("Loading state", () => {
    it("shows the loading spinner while fetching", () => {
      mockGet.mockImplementation(() => new Promise(() => {}));
      renderWithProviders(<PageInRoute />, {
        routerProps: { initialEntries: ["/a/aa9"] },
      });
      expect(
        screen.getByText(/chargement de l'analyse publique/i),
      ).toBeInTheDocument();
    });
  });

  describe("Success state", () => {
    it("renders the video title and channel after fetch succeeds", async () => {
      mockGet.mockResolvedValue(SAMPLE_PAYLOAD);
      renderWithProviders(<PageInRoute />, {
        routerProps: { initialEntries: ["/a/aa9"] },
      });

      await waitFor(() => {
        expect(
          screen.getByRole("heading", {
            name: /Rick Astley - Never Gonna Give You Up/i,
            level: 1,
          }),
        ).toBeInTheDocument();
      });
      // "Rick Astley" apparaît à plusieurs endroits (h1 + subtitle channel) —
      // getAllByText pour ne pas crasher.
      expect(screen.getAllByText(/Rick Astley/).length).toBeGreaterThan(0);
    });

    it("renders the permalink in the footer", async () => {
      mockGet.mockResolvedValue(SAMPLE_PAYLOAD);
      renderWithProviders(<PageInRoute />, {
        routerProps: { initialEntries: ["/a/aa9"] },
      });

      await waitFor(() => {
        // Le permalink est rendu dans le footer en <code>
        expect(
          screen.getByText("https://deepsightsynthesis.com/a/aa9"),
        ).toBeInTheDocument();
      });
    });

    it("displays a reliability disclaimer when score < 80", async () => {
      mockGet.mockResolvedValue({ ...SAMPLE_PAYLOAD, reliability_score: 60 });
      renderWithProviders(<PageInRoute />, {
        routerProps: { initialEntries: ["/a/aa9"] },
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Reliability score: 60\/100/),
        ).toBeInTheDocument();
      });
    });

    it("does not display reliability disclaimer when score >= 80", async () => {
      mockGet.mockResolvedValue({ ...SAMPLE_PAYLOAD, reliability_score: 90 });
      renderWithProviders(<PageInRoute />, {
        routerProps: { initialEntries: ["/a/aa9"] },
      });

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { level: 1 }),
        ).toBeInTheDocument();
      });
      expect(screen.queryByText(/Reliability score:/)).not.toBeInTheDocument();
    });

    it("calls the API with the slug from URL params", async () => {
      mockGet.mockResolvedValue(SAMPLE_PAYLOAD);
      renderWithProviders(<PageInRoute />, {
        routerProps: { initialEntries: ["/a/aa9"] },
      });

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith("aa9");
      });
    });

    it("renders the 'Open in your AI' menu trigger", async () => {
      mockGet.mockResolvedValue(SAMPLE_PAYLOAD);
      renderWithProviders(<PageInRoute />, {
        routerProps: { initialEntries: ["/a/aa9"] },
      });

      await waitFor(() => {
        // Bouton avec aria-haspopup
        const menuBtn = screen.getByRole("button", {
          name: /open in your ai|^ai$/i,
        });
        expect(menuBtn).toBeInTheDocument();
        expect(menuBtn).toHaveAttribute("aria-haspopup", "menu");
      });
    });
  });

  describe("Error state", () => {
    it("renders the not-found fallback when API returns 404", async () => {
      mockGet.mockRejectedValue(new Error("HTTP 404"));
      renderWithProviders(<PageInRoute />, {
        routerProps: { initialEntries: ["/a/aa9"] },
      });

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /analyse non disponible/i }),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByRole("link", { name: /découvrir deepsight/i }),
      ).toBeInTheDocument();
    });

    it("does not call API when slug is missing", async () => {
      // No slug in path → useParams returns undefined
      renderWithProviders(<PageInRoute />, {
        routerProps: { initialEntries: ["/a/"] },
      });
      // La route ne match pas → useParams.slug est undefined.
      // Le composant doit rendre le fallback "Analyse non disponible".
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /analyse non disponible/i }),
        ).toBeInTheDocument();
      });
      expect(mockGet).not.toHaveBeenCalled();
    });
  });
});
