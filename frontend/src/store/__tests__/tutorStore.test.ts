import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTutorStore } from "../tutorStore";

vi.mock("../../services/api", () => {
  class ApiError extends Error {
    status: number;
    data?: Record<string, unknown>;
    constructor(message: string, status: number, data?: Record<string, unknown>) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.data = data;
    }
    get isNotFound() {
      return this.status === 404;
    }
  }
  return {
    ApiError,
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
  };
});

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

  it("startSession pushes the user's concept_term as the first turn, then the agent's first_prompt", async () => {
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
    expect(s.messages).toHaveLength(2);
    expect(s.messages[0].role).toBe("user");
    expect(s.messages[0].content).toBe("Rasoir d'Occam");
    expect(s.messages[1].role).toBe("assistant");
    expect(s.messages[1].content).toBe(
      "Comment expliqueriez-vous ce concept ?",
    );
    expect(s.loading).toBe(false);
  });

  it("submitTextTurn appends user + assistant turns after the opening pair", async () => {
    await useTutorStore.getState().startSession({
      concept_term: "X",
      concept_def: "Y",
      mode: "text",
    });
    await useTutorStore.getState().submitTextTurn("Mon idée");
    const s = useTutorStore.getState();
    // Opening: user "X" + assistant first_prompt. Turn: user "Mon idée" + assistant.
    expect(s.messages).toHaveLength(4);
    expect(s.messages[0].role).toBe("user");
    expect(s.messages[0].content).toBe("X");
    expect(s.messages[1].role).toBe("assistant");
    expect(s.messages[2].role).toBe("user");
    expect(s.messages[2].content).toBe("Mon idée");
    expect(s.messages[3].role).toBe("assistant");
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
    // Optimistic user turn is rolled back so the empty-state UI returns.
    expect(s.messages).toEqual([]);
  });

  it("endSession({ keepMessages: true }) tears down the Redis session but keeps the local transcript", async () => {
    await useTutorStore.getState().startSession({
      concept_term: "X",
      concept_def: "Y",
      mode: "text",
    });
    await useTutorStore.getState().endSession({ keepMessages: true });
    const s = useTutorStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.sessionId).toBeNull();
    expect(s.conceptTerm).toBeNull();
    // Transcript stays visible — that's the contract of the unified hub.
    expect(s.messages).toHaveLength(2);
    expect(s.messages[0].role).toBe("user");
    expect(s.messages[1].role).toBe("assistant");
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

  // Regression : Redis TTL=1h, après idle > 1h le backend répond 404 sur /turn.
  // submitTextTurn doit relancer une session avec le même concept et rejouer
  // le turn sans propager l'erreur ni dupliquer le user turn déjà affiché.
  it("submitTextTurn auto-restarts the session on 404 (expired Redis) and replays the turn", async () => {
    const api = (await import("../../services/api")) as unknown as {
      ApiError: new (
        message: string,
        status: number,
        data?: Record<string, unknown>,
      ) => Error & { status: number };
      tutorApi: {
        sessionStart: ReturnType<typeof vi.fn>;
        sessionTurn: ReturnType<typeof vi.fn>;
        sessionEnd: ReturnType<typeof vi.fn>;
      };
    };

    // Ouvre la conv : 1er sessionStart succeeds, on enchaîne sur un /turn OK.
    await useTutorStore.getState().startSession({
      concept_term: "Shannon, 1948",
      concept_def: "Théorie de l'information",
      mode: "text",
    });
    expect(useTutorStore.getState().sessionId).toBe("tutor-test123");

    // Idle > 1h : prochain /turn renvoie 404, puis le store doit relancer une
    // session (nouvel id) et retry le /turn avec la nouvelle session.
    api.tutorApi.sessionTurn
      .mockRejectedValueOnce(new api.ApiError("Session non trouvée", 404))
      .mockResolvedValueOnce({
        ai_response: "Reprenons. Que pensez-vous de la théorie ?",
        audio_url: null,
        turn_count: 1,
      });
    api.tutorApi.sessionStart.mockResolvedValueOnce({
      session_id: "tutor-refresh999",
      first_prompt: "Nouvel opener (discarded)",
      audio_url: null,
    });

    await useTutorStore.getState().submitTextTurn("g");

    const s = useTutorStore.getState();
    expect(s.sessionId).toBe("tutor-refresh999");
    expect(s.error).toBeNull();
    expect(s.loading).toBe(false);
    // L'historique : opener user "Shannon, 1948" + opener assistant + user "g"
    // + nouvel assistant reply. Le first_prompt du restart n'est PAS injecté
    // (il est silencieusement discarded — Magistral repart de zéro côté backend).
    expect(s.messages).toHaveLength(4);
    expect(s.messages[2]).toMatchObject({ role: "user", content: "g" });
    expect(s.messages[3].role).toBe("assistant");
    expect(s.messages[3].content).toBe(
      "Reprenons. Que pensez-vous de la théorie ?",
    );
    // Une seule occurrence de "g" : pas de double-push optimiste.
    expect(s.messages.filter((m) => m.content === "g")).toHaveLength(1);
    // sessionStart a bien été appelée avec le concept préservé dans le store.
    expect(api.tutorApi.sessionStart).toHaveBeenCalledWith(
      expect.objectContaining({
        concept_term: "Shannon, 1948",
        concept_def: "Théorie de l'information",
        mode: "text",
      }),
    );
  });

  it("submitTextTurn surfaces non-404 errors without restarting", async () => {
    const api = (await import("../../services/api")) as unknown as {
      ApiError: new (
        message: string,
        status: number,
        data?: Record<string, unknown>,
      ) => Error & { status: number };
      tutorApi: {
        sessionStart: ReturnType<typeof vi.fn>;
        sessionTurn: ReturnType<typeof vi.fn>;
        sessionEnd: ReturnType<typeof vi.fn>;
      };
    };

    await useTutorStore.getState().startSession({
      concept_term: "X",
      concept_def: "Y",
      mode: "text",
    });
    const startCallsBefore = api.tutorApi.sessionStart.mock.calls.length;

    api.tutorApi.sessionTurn.mockRejectedValueOnce(
      new api.ApiError("Service indisponible", 502),
    );

    await useTutorStore.getState().submitTextTurn("Mon message");

    const s = useTutorStore.getState();
    expect(s.error).toBe("Service indisponible");
    expect(s.loading).toBe(false);
    // Pas de restart : sessionStart n'a pas été rappelée.
    expect(api.tutorApi.sessionStart.mock.calls.length).toBe(startCallsBefore);
  });
});
