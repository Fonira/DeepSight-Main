/**
 * 🎓 Le Tuteur — Tests du hook useTutor (state machine 4 phases).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTutor } from "../useTutor";

vi.mock("../../../services/api", () => ({
  tutorApi: {
    startSession: vi.fn().mockResolvedValue({
      session_id: "tutor-test123",
      first_prompt: "Comment expliqueriez-vous ce concept ?",
      audio_url: null,
    }),
    sendTurn: vi.fn().mockResolvedValue({
      ai_response: "Bonne idée. Et si...",
      audio_url: null,
      turn_count: 3,
    }),
    endSession: vi.fn().mockResolvedValue({
      duration_sec: 45,
      turns_count: 3,
      source_summary_url: "/dashboard?id=42",
      source_video_title: "Test video",
    }),
  },
}));

describe("useTutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("starts in idle phase", () => {
    const { result } = renderHook(() => useTutor());
    expect(result.current.phase).toBe("idle");
  });

  it("transitions idle → prompting on click", () => {
    const { result } = renderHook(() => useTutor());
    act(() => result.current.openPrompting());
    expect(result.current.phase).toBe("prompting");
  });

  it("starts mini-chat session on text mode", async () => {
    const { result } = renderHook(() => useTutor());
    await act(async () => {
      await result.current.startSession({
        concept_term: "Rasoir d'Occam",
        concept_def: "Principe de parcimonie",
        mode: "text",
      });
    });
    expect(result.current.phase).toBe("mini-chat");
    expect(result.current.sessionId).toBe("tutor-test123");
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("assistant");
  });

  it("appends user + assistant on submit", async () => {
    const { result } = renderHook(() => useTutor());
    await act(async () => {
      await result.current.startSession({
        concept_term: "X",
        concept_def: "Y",
        mode: "text",
      });
    });
    await act(async () => {
      await result.current.submitTextTurn("Mon idée");
    });
    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages[1].role).toBe("user");
    expect(result.current.messages[2].role).toBe("assistant");
  });

  it("ends session and returns to idle", async () => {
    const { result } = renderHook(() => useTutor());
    await act(async () => {
      await result.current.startSession({
        concept_term: "X",
        concept_def: "Y",
        mode: "text",
      });
    });
    await act(async () => {
      await result.current.endSession();
    });
    expect(result.current.phase).toBe("idle");
    expect(result.current.sessionId).toBeNull();
  });

  it("transitions mini-chat → deep-session on deepen()", async () => {
    const { result } = renderHook(() => useTutor());
    await act(async () => {
      await result.current.startSession({
        concept_term: "X",
        concept_def: "Y",
        mode: "text",
      });
    });
    act(() => result.current.deepen());
    expect(result.current.phase).toBe("deep-session");
  });
});
