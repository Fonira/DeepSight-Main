// frontend/src/components/Tutor/__tests__/TutorConceptsCarousel.test.tsx
//
// Tests Vitest + Testing Library pour le carrousel "Concepts illustrés"
// (sprint 2026-05-18). Mocke useTutorStore + useAuthContext pour isoler
// le composant des dépendances réseau et store réel.

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import TutorConceptsCarousel from "../TutorConceptsCarousel";
import type {
  TutorConceptItem,
  TutorConceptStatus,
} from "../../../types/conceptImage";

// ── Mock the Zustand store (leaf-selector aware) ────────────────────────
vi.mock("../../../store/tutorStore", () => ({
  useTutorStore: vi.fn(),
}));

// ── Mock AuthContext (default: Expert non-admin user) ───────────────────
const authMock: {
  user:
    | { plan: string | undefined; is_admin: boolean; email?: string }
    | null;
} = {
  user: { plan: "expert", is_admin: false, email: "test@example.com" },
};

vi.mock("../../../contexts/AuthContext", () => ({
  useAuthContext: () => authMock,
}));

// Imports happen AFTER vi.mock — typed access requires re-import.
import { useTutorStore } from "../../../store/tutorStore";

// ── Helpers ─────────────────────────────────────────────────────────────
interface StoreState {
  concepts: TutorConceptItem[];
  conceptsLoading: boolean;
  conceptsLastFetch: number | null;
  fetchConcepts: ReturnType<typeof vi.fn>;
  generateConcept: ReturnType<typeof vi.fn>;
  startConceptsPolling: ReturnType<typeof vi.fn>;
  stopConceptsPolling: ReturnType<typeof vi.fn>;
}

let mockState: StoreState;

function mockStore(state: Partial<StoreState> = {}) {
  mockState = {
    concepts: [],
    conceptsLoading: false,
    conceptsLastFetch: null,
    fetchConcepts: vi.fn(),
    generateConcept: vi.fn(),
    startConceptsPolling: vi.fn(),
    stopConceptsPolling: vi.fn(),
    ...state,
  };
  (useTutorStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (selector: (s: StoreState) => unknown) => selector(mockState),
  );
}

function makeConcept(
  term: string,
  status: TutorConceptStatus,
  imageUrl?: string,
): TutorConceptItem {
  return {
    term,
    term_hash: `hash_${term.replace(/\s+/g, "_")}_${status}`,
    category: null,
    image_url: imageUrl ?? null,
    status,
  };
}

beforeEach(() => {
  authMock.user = { plan: "expert", is_admin: false, email: "test@example.com" };
  mockStore();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TutorConceptsCarousel", () => {
  // ── Gating tests ──────────────────────────────────────────────────────
  it("returns null for a free user (no region rendered)", () => {
    authMock.user = { plan: "free", is_admin: false };
    mockStore();
    const { container } = render(<TutorConceptsCarousel />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("returns null for a pro user", () => {
    authMock.user = { plan: "pro", is_admin: false };
    mockStore();
    const { container } = render(<TutorConceptsCarousel />);
    expect(container.firstChild).toBeNull();
  });

  it("renders for an admin user even with plan=free (admin bypass)", () => {
    authMock.user = { plan: "free", is_admin: true };
    mockStore({ conceptsLastFetch: Date.now() });
    render(<TutorConceptsCarousel />);
    expect(
      screen.getByRole("region", { name: /concepts/i }),
    ).toBeInTheDocument();
  });

  it("renders for an Expert plan user", () => {
    mockStore({ conceptsLastFetch: Date.now() });
    render(<TutorConceptsCarousel />);
    expect(
      screen.getByRole("region", { name: /concepts/i }),
    ).toBeInTheDocument();
  });

  // ── Empty / loading states ─────────────────────────────────────────────
  it("renders silently (no empty message) on first fetch in flight", () => {
    mockStore({
      concepts: [],
      conceptsLoading: true,
      conceptsLastFetch: null,
    });
    render(<TutorConceptsCarousel />);
    // Region exists but no empty message — silent state has the dedicated marker.
    expect(screen.queryByTestId("tutor-concepts-empty")).toBeNull();
    expect(screen.getByTestId("tutor-concepts-silent")).toBeInTheDocument();
  });

  it("renders empty state message once a fetch returned 0 concepts", () => {
    mockStore({
      concepts: [],
      conceptsLoading: false,
      conceptsLastFetch: Date.now(),
    });
    render(<TutorConceptsCarousel />);
    expect(screen.getByTestId("tutor-concepts-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("tutor-concepts-list")).toBeNull();
  });

  // ── Rendering & filtering ──────────────────────────────────────────────
  it("renders 3 cards for 2 ready + 1 pending concepts", () => {
    const concepts: TutorConceptItem[] = [
      makeConcept("Rasoir d'Occam", "ready", "https://r2.example.com/a.png"),
      makeConcept("Effet Dunning-Kruger", "ready", "https://r2.example.com/b.png"),
      makeConcept("Biais de confirmation", "pending"),
    ];
    mockStore({ concepts, conceptsLastFetch: Date.now() });
    render(<TutorConceptsCarousel />);

    const list = screen.getByTestId("tutor-concepts-list");
    // 3 li children (cards).
    expect(list.querySelectorAll("li")).toHaveLength(3);
    // 2 <img> for ready concepts.
    expect(list.querySelectorAll("img")).toHaveLength(2);
  });

  it("filters out failed/throttled/missing concepts (only ready+pending visible)", () => {
    const concepts: TutorConceptItem[] = [
      makeConcept("Concept-ready", "ready", "https://r2.example.com/x.png"),
      makeConcept("Concept-failed", "failed"),
      makeConcept("Concept-throttled", "throttled"),
      makeConcept("Concept-missing", "missing"),
    ];
    mockStore({ concepts, conceptsLastFetch: Date.now() });
    render(<TutorConceptsCarousel />);

    const list = screen.getByTestId("tutor-concepts-list");
    expect(list.querySelectorAll("li")).toHaveLength(1);
    expect(screen.getByAltText("Concept-ready")).toBeInTheDocument();
  });

  // ── Click handling ─────────────────────────────────────────────────────
  it("calls onConceptClick with the concept when clicking a ready card", () => {
    const ready = makeConcept(
      "Rasoir d'Occam",
      "ready",
      "https://r2.example.com/a.png",
    );
    mockStore({ concepts: [ready], conceptsLastFetch: Date.now() });
    const onConceptClick = vi.fn();
    render(<TutorConceptsCarousel onConceptClick={onConceptClick} />);

    const card = screen.getByTestId(`concept-card-${ready.term_hash}`);
    fireEvent.click(card);

    expect(onConceptClick).toHaveBeenCalledTimes(1);
    expect(onConceptClick).toHaveBeenCalledWith(ready);
  });

  it("does NOT call onConceptClick when clicking a pending card (no-op)", () => {
    const pending = makeConcept("Concept-en-cours", "pending");
    mockStore({ concepts: [pending], conceptsLastFetch: Date.now() });
    const onConceptClick = vi.fn();
    render(<TutorConceptsCarousel onConceptClick={onConceptClick} />);

    const card = screen.getByTestId(`concept-card-${pending.term_hash}`);
    fireEvent.click(card);

    expect(onConceptClick).not.toHaveBeenCalled();
  });

  // ── Accessibility ──────────────────────────────────────────────────────
  it("exposes a region role with descriptive aria-label", () => {
    mockStore({ conceptsLastFetch: Date.now() });
    render(<TutorConceptsCarousel />);
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/concepts/i),
    );
  });

  it("sets aria-busy=true while conceptsLoading is true", () => {
    mockStore({
      concepts: [makeConcept("X", "ready", "https://r2.example.com/x.png")],
      conceptsLoading: true,
      conceptsLastFetch: Date.now(),
    });
    render(<TutorConceptsCarousel />);
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-busy", "true");
  });

  // ── Lifecycle (polling start/stop) ─────────────────────────────────────
  it("calls startConceptsPolling on mount", () => {
    mockStore();
    render(<TutorConceptsCarousel />);
    expect(mockState.startConceptsPolling).toHaveBeenCalledTimes(1);
    expect(mockState.stopConceptsPolling).not.toHaveBeenCalled();
  });

  it("calls stopConceptsPolling on unmount", () => {
    mockStore();
    const { unmount } = render(<TutorConceptsCarousel />);
    expect(mockState.stopConceptsPolling).not.toHaveBeenCalled();
    unmount();
    expect(mockState.stopConceptsPolling).toHaveBeenCalledTimes(1);
  });

  it("does NOT start polling when user is not allowed (free plan)", () => {
    authMock.user = { plan: "free", is_admin: false };
    mockStore();
    render(<TutorConceptsCarousel />);
    expect(mockState.startConceptsPolling).not.toHaveBeenCalled();
  });
});
