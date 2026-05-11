import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTutorStore } from "../tutorStore";

vi.mock("../../services/api", () => ({
  tutorApi: {
    sessionStart: vi.fn().mockResolvedValue({
      session_id: "tutor-test123",
      first_prompt: "Comment expliqueriez-vous ce concept ?",
      audio_url: null,
    }),
    sessionTurn: vi.fn().mockResolvedValue({
      ai_response: "Très bien.",
      audio_url: null,
      turn_count: 3,
    }),
    sessionEnd: vi.fn().mockResolvedValue({
      duration_sec: 45,
      turns_count: 3,
      source_summary_url: null,
      source_video_title: null,
    }),
  },
}));

describe("tutorStore", () => {
  beforeEach(() => {
    useTutorStore.getState().reset();
  });

  it("initial state has idle phase, no session, empty messages", () => {
    const s = useTutorStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.sessionId).toBeNull();
    expect(s.messages).toEqual([]);
    expect(s.conceptTerm).toBeNull();
    expect(s.fullscreen).toBe(false);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it("openPrompting → phase = prompting", () => {
    useTutorStore.getState().openPrompting();
    expect(useTutorStore.getState().phase).toBe("prompting");
    expect(useTutorStore.getState().error).toBeNull();
  });

  it("cancelPrompting → phase = idle", () => {
    useTutorStore.getState().openPrompting();
    useTutorStore.getState().cancelPrompting();
    expect(useTutorStore.getState().phase).toBe("idle");
  });

  it("startSession populates state and appends first assistant message", async () => {
    await useTutorStore.getState().startSession({
      concept_term: "Rasoir d'Occam",
      concept_def: "Principe de parcimonie",
      mode: "text",
    });
    const s = useTutorStore.getState();
    expect(s.phase).toBe("mini-chat");
    expect(s.sessionId).toBe("tutor-test123");
    expect(s.conceptTerm).toBe("Rasoir d'Occam");
    expect(s.conceptDef).toBe("Principe de parcimonie");
    expect(s.messages).toHaveLength(1);
    expect(s.messages[0].role).toBe("assistant");
    expect(s.loading).toBe(false);
  });

  it("submitTextTurn pushes user then assistant messages", async () => {
    await useTutorStore.getState().startSession({
      concept_term: "X",
      concept_def: "Y",
      mode: "text",
    });
    await useTutorStore.getState().submitTextTurn("Mon idée");
    const s = useTutorStore.getState();
    expect(s.messages).toHaveLength(3);
    expect(s.messages[1].role).toBe("user");
    expect(s.messages[1].content).toBe("Mon idée");
    expect(s.messages[2].role).toBe("assistant");
  });

  it("submitTextTurn is no-op without a session", async () => {
    await useTutorStore.getState().submitTextTurn("Test sans session");
    expect(useTutorStore.getState().messages).toHaveLength(0);
  });

  it("endSession resets state back to initial", async () => {
    await useTutorStore.getState().startSession({
      concept_term: "X",
      concept_def: "Y",
      mode: "text",
    });
    await useTutorStore.getState().endSession();
    const s = useTutorStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.sessionId).toBeNull();
    expect(s.messages).toEqual([]);
    expect(s.conceptTerm).toBeNull();
  });

  it("setFullscreen toggles fullscreen flag", () => {
    useTutorStore.getState().setFullscreen(true);
    expect(useTutorStore.getState().fullscreen).toBe(true);
    useTutorStore.getState().setFullscreen(false);
    expect(useTutorStore.getState().fullscreen).toBe(false);
  });

  it("startSession on failure surfaces error and clears loading", async () => {
    const api = (await import("../../services/api")) as unknown as {
      tutorApi: {
        sessionStart: ReturnType<typeof vi.fn>;
        sessionTurn: ReturnType<typeof vi.fn>;
        sessionEnd: ReturnType<typeof vi.fn>;
      };
    };
    api.tutorApi.sessionStart.mockRejectedValueOnce(
      new Error("boom"),
    );
    await useTutorStore.getState().startSession({
      concept_term: "X",
      concept_def: "Y",
      mode: "text",
    });
    const s = useTutorStore.getState();
    expect(s.error).toBe("boom");
    expect(s.loading).toBe(false);
    expect(s.phase).toBe("idle");
  });

  it("reset clears state immediately", async () => {
    await useTutorStore.getState().startSession({
      concept_term: "X",
      concept_def: "Y",
      mode: "text",
    });
    useTutorStore.getState().reset();
    const s = useTutorStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.sessionId).toBeNull();
    expect(s.messages).toEqual([]);
  });
});
