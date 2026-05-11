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

// Mock useVoiceChat so the test never touches the ElevenLabs SDK / network.
// The TutorHub now mounts the voice hook directly (no VoiceOverlay wrapper).
const voiceMock = vi.hoisted(() => ({
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  toggleMute: vi.fn(),
  sendUserMessage: vi.fn(),
  prewarm: vi.fn(),
  startTalking: vi.fn(),
  stopTalking: vi.fn(),
  restart: vi.fn().mockResolvedValue(undefined),
  voiceSessionId: null,
  sessionStartedAt: null,
  status: "idle" as const,
  isSpeaking: false,
  isMuted: false,
  isTalking: false,
  inputMode: "ptt" as const,
  pttKey: " ",
  activeTool: null,
  messages: [] as Array<{ text: string; source: "user" | "ai" }>,
  elapsedSeconds: 0,
  remainingMinutes: 0,
  error: null,
  playbackRate: 1.0,
  micStream: { current: null },
}));

vi.mock("../../voice/useVoiceChat", () => ({
  useVoiceChat: () => voiceMock,
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
    voiceMock.start.mockClear();
    voiceMock.stop.mockClear();
    voiceMock.toggleMute.mockClear();
    voiceMock.sendUserMessage.mockClear();
    voiceMock.status = "idle";
    voiceMock.isSpeaking = false;
    voiceMock.isMuted = false;
    voiceMock.messages = [];
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

  it("honors defaultMode='voice' and mounts the voice pane", () => {
    render(<TutorHub isOpen onClose={vi.fn()} defaultMode="voice" />);
    expect(screen.getByTestId("tutor-hub-voice-pane")).toBeInTheDocument();
    expect(screen.getByTestId("tutor-hub-mode-voice")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("auto-starts the voice call when entering voice mode", async () => {
    render(<TutorHub isOpen onClose={vi.fn()} defaultMode="voice" />);
    await waitFor(() => {
      expect(voiceMock.start).toHaveBeenCalled();
    });
  });

  it("switches text → voice without confirm when no messages", () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => true);
    render(<TutorHub isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId("tutor-hub-mode-voice"));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("tutor-hub-voice-pane")).toBeInTheDocument();
  });

  it("asks confirm + ends text session when switching text → voice with existing messages", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => true);
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
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledTimes(1);
    });
    await waitFor(
      () => {
        expect(tutorApiMock.sessionEnd).toHaveBeenCalled();
        expect(screen.getByTestId("tutor-hub-voice-pane")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("does NOT switch to voice when user cancels the confirm", async () => {
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
    await waitFor(() => {
      expect(screen.queryByTestId("tutor-hub-voice-pane")).toBeNull();
    });
    expect(tutorApiMock.sessionEnd).not.toHaveBeenCalled();
  });

  it("voice → text never prompts confirm (call just stops, transcript stays)", async () => {
    const confirmSpy = vi
      .spyOn(window, "confirm")
      .mockImplementation(() => true);
    render(<TutorHub isOpen onClose={vi.fn()} defaultMode="voice" />);
    // Pretend the call is active
    voiceMock.status = "listening";
    fireEvent.click(screen.getByTestId("tutor-hub-mode-text"));
    await waitFor(() => {
      expect(screen.getByTestId("tutor-hub-text-input")).toBeInTheDocument();
    });
    expect(confirmSpy).not.toHaveBeenCalled();
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
    fireEvent.change(screen.getByTestId("tutor-hub-text-input"), {
      target: { value: "Première question" },
    });
    fireEvent.click(screen.getByTestId("tutor-hub-text-send"));
    await waitFor(() => {
      expect(tutorApiMock.sessionStart).toHaveBeenCalled();
    });
    // First submit sends empty concept_def — backend now accepts it
    const args = tutorApiMock.sessionStart.mock.calls[0]?.[0];
    expect(args).toMatchObject({
      concept_term: "Première question",
      concept_def: "",
      mode: "text",
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

  it("merges voice transcripts into the unified timeline (mic icon visible)", async () => {
    voiceMock.messages = [
      { source: "ai", text: "Bonjour, je suis le tuteur vocal." },
      { source: "user", text: "Salut, parlons d'éthique." },
    ];
    render(<TutorHub isOpen onClose={vi.fn()} defaultMode="voice" />);
    await waitFor(() => {
      expect(
        screen.getByText("Bonjour, je suis le tuteur vocal."),
      ).toBeInTheDocument();
      expect(screen.getByText("Salut, parlons d'éthique.")).toBeInTheDocument();
    });
    // Two voice messages → at least two mic icons rendered in the transcript
    const transcript = screen.getByTestId("tutor-hub-text-transcript");
    expect(
      transcript.querySelectorAll('svg[aria-label="voice"]').length,
    ).toBeGreaterThanOrEqual(2);
  });
});
