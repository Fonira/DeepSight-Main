// frontend/src/components/hub/__tests__/HubAnalysisPanel.test.tsx
//
// Smoke tests pour le wrapper HubAnalysisPanel. On mock AnalysisHub pour
// isoler la logique du wrapper (gating sur selectedSummary, props passées,
// container styling) — l'AnalysisHub lui-même est testé via la suite
// AnalysisHub/* à part.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HubAnalysisPanel } from "../HubAnalysisPanel";
import type {
  Summary,
  EnrichedConcept,
  ReliabilityResult,
  User,
} from "../../../services/api";

// Mock AnalysisHub: on capture les props pour vérifier le wiring sans avoir
// à monter toute l'arborescence (Markdown, Concepts, etc.).
vi.mock("../../AnalysisHub", () => ({
  AnalysisHub: (props: {
    selectedSummary: Summary;
    concepts: EnrichedConcept[];
    reliabilityData: ReliabilityResult | null;
    enabledTabs?: string[];
  }) => (
    <div data-testid="analysis-hub-mock">
      <span data-testid="ah-summary-id">{props.selectedSummary.id}</span>
      <span data-testid="ah-concepts-count">{props.concepts.length}</span>
      <span data-testid="ah-tabs">{(props.enabledTabs ?? []).join(",")}</span>
      <span data-testid="ah-has-reliability">
        {props.reliabilityData ? "yes" : "no"}
      </span>
    </div>
  ),
}));

const summary: Summary = {
  id: 42,
  video_id: "abc123",
  video_title: "Test Video",
  video_channel: "Test Channel",
  summary_content: "Long markdown content here.",
  created_at: "2026-04-30T00:00:00Z",
  platform: "youtube",
};

const concept: EnrichedConcept = {
  term: "Conscience phénoménale",
  definition: "Expérience subjective.",
  category: "philosophy",
  category_label: "Philosophie",
  category_icon: "🧠",
  context_relevance: "Concept central de la vidéo.",
  sources: [],
  confidence: 0.9,
  provider: "mistral",
};

const fakeUser: User = {
  id: 1,
  username: "tester",
  email: "test@example.com",
  email_verified: true,
  plan: "pro",
  credits: 30,
  credits_monthly: 30,
  is_admin: false,
  total_videos: 0,
  total_words: 0,
  total_playlists: 0,
  created_at: "2026-04-30T00:00:00Z",
};

interface PanelOverrides {
  selectedSummary?: Summary | null;
  concepts?: EnrichedConcept[];
  reliability?: ReliabilityResult | null;
  reliabilityLoading?: boolean;
  user?: User | null;
}

const renderPanel = (overrides: PanelOverrides = {}) => {
  // Use `in` checks instead of `??` so callers can explicitly pass `null` to
  // override defaults (e.g. selectedSummary: null for the empty-state test).
  const selectedSummary =
    "selectedSummary" in overrides ? overrides.selectedSummary! : summary;
  const concepts = "concepts" in overrides ? overrides.concepts! : [concept];
  const reliability =
    "reliability" in overrides ? overrides.reliability! : null;
  const reliabilityLoading = overrides.reliabilityLoading ?? false;
  const user = "user" in overrides ? overrides.user! : fakeUser;
  return render(
    <MemoryRouter>
      <HubAnalysisPanel
        selectedSummary={selectedSummary}
        concepts={concepts}
        reliability={reliability}
        reliabilityLoading={reliabilityLoading}
        user={user}
        language="fr"
        activeTab="synthesis"
        onTabChange={vi.fn()}
      />
    </MemoryRouter>,
  );
};

describe("HubAnalysisPanel", () => {
  // Vitest + globals=true relies on RTL's auto-cleanup via the `afterEach`
  // hook, but to keep these specs hermetic we still call cleanup explicitly
  // — defensive against ordering surprises.
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when selectedSummary is null", () => {
    const { container } = renderPanel({ selectedSummary: null });
    expect(screen.queryByTestId("analysis-hub-mock")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("renders the AnalysisHub container when summary + concepts are passed", () => {
    renderPanel();
    expect(screen.getByTestId("analysis-hub-mock")).toBeInTheDocument();
    expect(screen.getByTestId("ah-summary-id")).toHaveTextContent("42");
    expect(screen.getByTestId("ah-concepts-count")).toHaveTextContent("1");
    // The 5 tabs are explicitly enabled by HubAnalysisPanel.
    expect(screen.getByTestId("ah-tabs")).toHaveTextContent(
      "synthesis,reliability,quiz,flashcards,geo",
    );
  });

  it("does not crash with empty concepts array (just shows synthesis tab content)", () => {
    renderPanel({ concepts: [] });
    expect(screen.getByTestId("analysis-hub-mock")).toBeInTheDocument();
    expect(screen.getByTestId("ah-concepts-count")).toHaveTextContent("0");
    // No reliability data → still renders, AnalysisHub handles its own empty state.
    expect(screen.getByTestId("ah-has-reliability")).toHaveTextContent("no");
  });
});
