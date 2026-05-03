// mobile/src/components/tutor/__tests__/useTutor.test.ts
//
// Tests state machine + async flow du hook V2 mobile lite.

import { renderHook, act } from "@testing-library/react-native";
import { useTutor } from "../useTutor";
import { tutorApi } from "../../../services/api";

jest.mock("../../../services/api", () => ({
  tutorApi: {
    sessionStart: jest.fn(),
    sessionTurn: jest.fn(),
    sessionEnd: jest.fn(),
  },
}));

const mockedSessionStart = tutorApi.sessionStart as jest.MockedFunction<
  typeof tutorApi.sessionStart
>;
const mockedSessionTurn = tutorApi.sessionTurn as jest.MockedFunction<
  typeof tutorApi.sessionTurn
>;
const mockedSessionEnd = tutorApi.sessionEnd as jest.MockedFunction<
  typeof tutorApi.sessionEnd
>;

describe("useTutor (V2 mobile lite)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("démarre en phase idle avec messages vides", () => {
    const { result } = renderHook(() => useTutor());
    expect(result.current.phase).toBe("idle");
    expect(result.current.messages).toEqual([]);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("startSession passe en phase active + ajoute le 1er prompt", async () => {
    mockedSessionStart.mockResolvedValueOnce({
      session_id: "sess_abc",
      first_prompt: "Comment définiriez-vous ce concept ?",
      audio_url: null,
    });

    const { result } = renderHook(() => useTutor());

    await act(async () => {
      await result.current.startSession({
        concept_term: "Rasoir d'Occam",
        concept_def: "Principe de parcimonie",
        summary_id: 42,
        source_video_title: "Philosophie 101",
      });
    });

    expect(mockedSessionStart).toHaveBeenCalledWith({
      concept_term: "Rasoir d'Occam",
      concept_def: "Principe de parcimonie",
      summary_id: 42,
      source_video_title: "Philosophie 101",
      mode: "text",
      lang: "fr",
    });
    expect(result.current.phase).toBe("active");
    expect(result.current.sessionId).toBe("sess_abc");
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      role: "assistant",
      content: "Comment définiriez-vous ce concept ?",
    });
    expect(result.current.conceptTerm).toBe("Rasoir d'Occam");
  });

  it("submitTextTurn ajoute message user puis assistant", async () => {
    mockedSessionStart.mockResolvedValueOnce({
      session_id: "sess_xyz",
      first_prompt: "Premier prompt",
      audio_url: null,
    });
    mockedSessionTurn.mockResolvedValueOnce({
      ai_response: "Réponse IA",
      audio_url: null,
      turn_count: 1,
    });

    const { result } = renderHook(() => useTutor());

    await act(async () => {
      await result.current.startSession({
        concept_term: "Concept",
        concept_def: "Definition",
      });
    });

    await act(async () => {
      await result.current.submitTextTurn("Question user");
    });

    expect(mockedSessionTurn).toHaveBeenCalledWith("sess_xyz", {
      user_input: "Question user",
    });
    // 1er prompt + user + assistant = 3
    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages[1]).toMatchObject({
      role: "user",
      content: "Question user",
    });
    expect(result.current.messages[2]).toMatchObject({
      role: "assistant",
      content: "Réponse IA",
    });
    expect(result.current.loading).toBe(false);
  });

  it("submitTextTurn n'appelle pas l'API si pas de session", async () => {
    const { result } = renderHook(() => useTutor());

    await act(async () => {
      await result.current.submitTextTurn("Question orpheline");
    });

    expect(mockedSessionTurn).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });

  it("startSession transmet l'erreur dans state.error", async () => {
    mockedSessionStart.mockRejectedValueOnce(new Error("Quota dépassé"));

    const { result } = renderHook(() => useTutor());

    await act(async () => {
      await result.current.startSession({
        concept_term: "X",
        concept_def: "Y",
      });
    });

    expect(result.current.error).toBe("Quota dépassé");
    expect(result.current.phase).toBe("idle");
    expect(result.current.loading).toBe(false);
  });

  it("submitTextTurn transmet l'erreur dans state.error", async () => {
    mockedSessionStart.mockResolvedValueOnce({
      session_id: "sess_err",
      first_prompt: "p",
      audio_url: null,
    });
    mockedSessionTurn.mockRejectedValueOnce(new Error("Network down"));

    const { result } = renderHook(() => useTutor());

    await act(async () => {
      await result.current.startSession({
        concept_term: "T",
        concept_def: "D",
      });
    });

    await act(async () => {
      await result.current.submitTextTurn("hello");
    });

    expect(result.current.error).toBe("Network down");
    expect(result.current.loading).toBe(false);
  });

  it("endSession appelle l'API et reset l'état", async () => {
    mockedSessionStart.mockResolvedValueOnce({
      session_id: "sess_end",
      first_prompt: "p",
      audio_url: null,
    });
    mockedSessionEnd.mockResolvedValueOnce({
      duration_sec: 120,
      turns_count: 2,
      source_summary_url: null,
      source_video_title: null,
    });

    const { result } = renderHook(() => useTutor());

    await act(async () => {
      await result.current.startSession({
        concept_term: "T",
        concept_def: "D",
      });
    });

    expect(result.current.sessionId).toBe("sess_end");

    await act(async () => {
      await result.current.endSession();
    });

    expect(mockedSessionEnd).toHaveBeenCalledWith("sess_end");
    expect(result.current.phase).toBe("idle");
    expect(result.current.sessionId).toBeNull();
    expect(result.current.messages).toEqual([]);
  });

  it("endSession ne crash pas si pas de session", async () => {
    const { result } = renderHook(() => useTutor());

    await act(async () => {
      await result.current.endSession();
    });

    expect(mockedSessionEnd).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("idle");
  });

  it("endSession swallow erreur API (best effort) et reset quand même", async () => {
    mockedSessionStart.mockResolvedValueOnce({
      session_id: "sess_swallow",
      first_prompt: "p",
      audio_url: null,
    });
    mockedSessionEnd.mockRejectedValueOnce(new Error("500 server"));

    const { result } = renderHook(() => useTutor());

    await act(async () => {
      await result.current.startSession({
        concept_term: "T",
        concept_def: "D",
      });
    });

    await act(async () => {
      await result.current.endSession();
    });

    // L'erreur ne bloque pas la fermeture
    expect(result.current.phase).toBe("idle");
    expect(result.current.sessionId).toBeNull();
  });
});
