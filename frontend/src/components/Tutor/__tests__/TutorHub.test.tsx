// frontend/src/components/Tutor/__tests__/TutorHub.test.tsx
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TutorHub } from "../TutorHub";
import { useTutorStore } from "../../../store/tutorStore";

beforeAll(() => {
  Element.prototype.scrollTo =
    vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

// Stub VoiceOverlay so the test never touches ElevenLabs SDK / network.
// Use a tiny placeholder so we can assert that voice mode mounts it.
vi.mock("../../voice/VoiceOverlay", () => ({
  VoiceOverlay: ({ agentType }: { agentType?: string }) => (
    <div data-testid="voice-overlay-stub" data-agent-type={agentType ?? ""} />
  ),
}));

// TutorHub reads the language via useContext(LanguageContext) with a safe
// fallback to "fr". No provider needed in tests — pass `language` prop if
// a specific value is required.

const tutorApiMock = vi.hoisted(() => ({
  sessionStart: vi.fn().mockResolvedValue({
    session_id: "tutor-hub-session",
    first_prompt: "Premier message agent.",
    audio_url: null,
  }),
  sessionTurn: vi.fn().mockResolvedValue({
    ai_response: "Réponse agent.",
    audio_url: null,
    turn_count: 3,
  }),
  sessionEnd: vi.fn().mockResolvedValue({
    duration_sec: 30,
    turns_count: 3,
    source_summary_url: null,
    source_video_title: null,
  }),
}));

vi.mock("../../../services/api", () => ({
  tutorApi: tutorApiMock,
}));

describe("TutorHub", () => {
  beforeEach(() => {
    useTutorStore.getState().reset();
    tutorApiMock.sessionStart.mockReset().mockResolvedValue({
      session_id: "tutor-hub-session",
      first_prompt: "Premier message agent.",
      audio_url: null,
    });
    tutorApiMock.sessionTurn.mockReset().mockResolvedValue({
      ai_response: "Réponse agent.",
      audio_url: null,
      turn_count: 3,
    });
    tutorApiMock.sessionEnd.mockReset().mockResolvedValue({
      duration_sec: 30,
      turns_count: 3,
      source_summary_url: null,
      source_video_title: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <TutorHub isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.querySelector('[data-testid="tutor-hub"]')).toBeNull();
  });

  it("renders the hub dialog when open", () => {
    render(<TutorHub isOpen onClose={vi.fn()} />);
    expect(screen.getByTestId("tutor-hub")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /tuteur/i })).toBeInTheDocument();
  });

  it("defaults to text mode and exposes both toggle tabs", () => {
    render(<TutorHub isOpen onClose={vi.fn()} />);
    const textTab = screen.getByTestId("tutor-hub-mode-text");
    const voiceTab = screen.getByTestId("tutor-hub-mode-voice");
    expect(textTab).toHaveAttribute("aria-selected", "true");
    expect(voiceTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("tutor-hub-text-input")).toBeInTheDocument();
  });

  it("honors defaultMode='voice' and mounts VoiceOverlay with knowledge_tutor", () => {
    render(<TutorHub isOpen onClose={vi.fn()} defaultMode="voice" />);
    const stub = screen.getByTestId("voice-overlay-stub");
    expect(stub).toBeInTheDocument();
    expect(stub.getAttribute("data-agent-type")).toBe("knowledge_tutor");
    expect(screen.getByTestId("tutor-hub-mode-voice")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches text → voice without confirm when no messages", () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => true);
    render(<TutorHub isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId("tutor-hub-mode-voice"));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("voice-overlay-stub")).toBeInTheDocument();
  });

  it("asks confirm + restarts when switching with existing messages", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => true);
    render(<TutorHub isOpen onClose={vi.fn()} />);
    // Seed a session with one user/assistant pair via the store directly,
    // wait for React to flush the new state into the component.
    await useTutorStore.getState().startSession({
      concept_term: "X",
      concept_def: "Y",
      mode: "text",
    });
    await waitFor(() => {
      expect(screen.getByText("Premier message agent.")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("tutor-hub-mode-voice"));
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledTimes(1);
    });
    await waitFor(
      () => {
        expect(tutorApiMock.sessionEnd).toHaveBeenCalled();
        expect(screen.getByTestId("voice-overlay-stub")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("does NOT switch when user cancels the confirm", async () => {
    vi.spyOn(window, "confirm").mockImplementation(() => false);
    render(<TutorHub isOpen onClose={vi.fn()} />);
    await useTutorStore.getState().startSession({
      concept_term: "X",
      concept_def: "Y",
      mode: "text",
    });
    await waitFor(() => {
      expect(screen.getByText("Premier message agent.")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("tutor-hub-mode-voice"));
    // Still in text mode — no VoiceOverlay rendered.
    await waitFor(() => {
      expect(screen.queryByTestId("voice-overlay-stub")).toBeNull();
    });
    expect(tutorApiMock.sessionEnd).not.toHaveBeenCalled();
  });

  it("auto-starts a text session when initialContext is supplied", async () => {
    render(
      <TutorHub
        isOpen
        onClose={vi.fn()}
        initialContext={{
          conceptTerm: "Rasoir d'Occam",
          conceptDef: "Principe de parcimonie",
          summaryId: 42,
        }}
      />,
    );
    await waitFor(() => {
      expect(tutorApiMock.sessionStart).toHaveBeenCalledTimes(1);
    });
    const args = tutorApiMock.sessionStart.mock.calls[0]?.[0];
    expect(args).toMatchObject({
      concept_term: "Rasoir d'Occam",
      summary_id: 42,
      mode: "text",
    });
  });

  it("submits a text turn via the input + send button", async () => {
    render(<TutorHub isOpen onClose={vi.fn()} />);
    // First submit kicks off a session (no current term), second sends a turn.
    fireEvent.change(screen.getByTestId("tutor-hub-text-input"), {
      target: { value: "Première question" },
    });
    fireEvent.click(screen.getByTestId("tutor-hub-text-send"));
    await waitFor(() => {
      expect(tutorApiMock.sessionStart).toHaveBeenCalled();
    });
  });

  it("close button calls onClose AND ends the text session if active", async () => {
    const onClose = vi.fn();
    render(<TutorHub isOpen onClose={onClose} />);
    await useTutorStore.getState().startSession({
      concept_term: "X",
      concept_def: "Y",
      mode: "text",
    });
    await waitFor(() => {
      expect(screen.getByText("Premier message agent.")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("tutor-hub-close"));
    await waitFor(
      () => {
        expect(onClose).toHaveBeenCalled();
        expect(tutorApiMock.sessionEnd).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );
  });
});
