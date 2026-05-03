/**
 * Tests unitaires — tutorApi (Le Tuteur conversationnel)
 *
 * Vérifie pour chaque endpoint :
 *   - le path/method appelé
 *   - le body sérialisé
 *   - le header Authorization avec le token courant
 *   - le parsing de la réponse JSON
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

import { tutorApi, setTokens } from "../api";
import type {
  TutorSessionStartRequest,
  TutorSessionTurnRequest,
} from "../../types/tutor";

describe("tutorApi.startSession", () => {
  it("calls POST /api/tutor/session/start with payload + auth header", async () => {
    setTokens("access-tok", "refresh-tok");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        session_id: "tutor-abc123",
        first_prompt: "Voyons ensemble : quelle définition donneriez-vous ?",
        audio_url: null,
      }),
    });

    const payload: TutorSessionStartRequest = {
      concept_term: "Rasoir d'Occam",
      concept_def: "Principe de parcimonie",
      summary_id: 42,
      source_video_title: "Logique 101",
      mode: "text",
      lang: "fr",
    };

    const promise = tutorApi.startSession(payload);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/tutor/session/start");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer access-tok");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body as string)).toEqual(payload);
    expect(result.session_id).toBe("tutor-abc123");
    expect(result.first_prompt).toContain("Voyons ensemble");
    expect(result.audio_url).toBeNull();
  });

  it("supports voice mode and audio_url response (V1.1)", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        session_id: "tutor-voice-1",
        first_prompt: "Bonjour.",
        audio_url: "https://cdn.example.com/tts/abc.mp3",
      }),
    });

    const promise = tutorApi.startSession({
      concept_term: "Entropie",
      concept_def: "Mesure du désordre",
      mode: "voice",
      lang: "fr",
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.audio_url).toBe("https://cdn.example.com/tts/abc.mp3");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.mode).toBe("voice");
  });
});

describe("tutorApi.sendTurn", () => {
  it("calls POST /api/tutor/session/{id}/turn with text payload", async () => {
    setTokens("tok-2", "ref-2");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ai_response: "Bonne réflexion. Et si on appliquait à un cas concret ?",
        audio_url: null,
        turn_count: 2,
      }),
    });

    const payload: TutorSessionTurnRequest = {
      user_input: "C'est le principe de simplicité.",
    };

    const promise = tutorApi.sendTurn("tutor-abc123", payload);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/tutor/session/tutor-abc123/turn");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer tok-2");
    expect(JSON.parse(options.body as string)).toEqual(payload);
    expect(result.ai_response).toContain("Bonne réflexion");
    expect(result.turn_count).toBe(2);
    expect(result.audio_url).toBeNull();
  });

  it("supports audio_blob_b64 payload for voice mode (V1.1)", async () => {
    setTokens("tok-3", "ref-3");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ai_response: "Très bien.",
        audio_url: "https://cdn.example.com/tts/turn2.mp3",
        turn_count: 3,
      }),
    });

    const promise = tutorApi.sendTurn("session-x", {
      audio_blob_b64: "AAAAaWFEaW8=",
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.audio_blob_b64).toBe("AAAAaWFEaW8=");
    expect(result.audio_url).toContain(".mp3");
  });
});

describe("tutorApi.endSession", () => {
  it("calls POST /api/tutor/session/{id}/end with empty body", async () => {
    setTokens("tok-4", "ref-4");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        duration_sec: 312,
        turns_count: 7,
        source_summary_url: "/dashboard/analyses/42",
        source_video_title: "Logique 101",
      }),
    });

    const promise = tutorApi.endSession("tutor-abc123");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/tutor/session/tutor-abc123/end");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer tok-4");
    expect(JSON.parse(options.body as string)).toEqual({});
    expect(result.duration_sec).toBe(312);
    expect(result.turns_count).toBe(7);
    expect(result.source_summary_url).toBe("/dashboard/analyses/42");
  });

  it("handles null source fields when session had no summary_id", async () => {
    setTokens("tok-5", "ref-5");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        duration_sec: 60,
        turns_count: 2,
        source_summary_url: null,
        source_video_title: null,
      }),
    });

    const promise = tutorApi.endSession("anon-session");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.source_summary_url).toBeNull();
    expect(result.source_video_title).toBeNull();
  });
});
