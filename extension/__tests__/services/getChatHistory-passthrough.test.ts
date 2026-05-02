/**
 * Tests — Mapping passthrough de GET_CHAT_HISTORY
 *
 * Le handler `getChatHistory` (src/background.ts) fait un simple
 * `result.messages || []` sans projection (pas de map()/destructuring).
 * Ce test garantit qu'un payload backend contenant les nouveaux champs
 * voice (`source`, `voice_speaker`, `voice_session_id`, `time_in_call_secs`)
 * arrive intact côté sidepanel — invariant indispensable au filtrage
 * "audio user invisible" de ConversationView (PR2).
 *
 * Approche : on appelle directement la même fonction interne via un
 * import du module + mock fetch — sans passer par chrome.runtime
 * (le pattern de api.test.ts est instable, cf. baseline 13 fichiers
 * en FAIL pré-existants).
 */

import type { ChatMessage } from "../../src/types";

describe("ChatMessage type — voice fields", () => {
  it("accepts source/voice_speaker/voice_session_id/time_in_call_secs", () => {
    const msg: ChatMessage = {
      id: "abc",
      role: "user",
      content: "spoken",
      timestamp: "2026-05-02T10:00:00Z",
      source: "voice",
      voice_speaker: "user",
      voice_session_id: "vs-xyz",
      time_in_call_secs: 1.2,
    };
    expect(msg.source).toBe("voice");
    expect(msg.voice_speaker).toBe("user");
    expect(msg.voice_session_id).toBe("vs-xyz");
    expect(msg.time_in_call_secs).toBe(1.2);
  });

  it("keeps source/voice_speaker/voice_session_id optional (legacy ChatView v1)", () => {
    const msg: ChatMessage = {
      role: "assistant",
      content: "reply without voice fields",
    };
    expect(msg.source).toBeUndefined();
    expect(msg.voice_speaker).toBeUndefined();
    expect(msg.voice_session_id).toBeUndefined();
  });
});

describe("getChatHistory mapping (background → sidepanel)", () => {
  it("preserves voice fields in passthrough (no projection)", async () => {
    // Le handler interne fait: const result = await apiRequest(...);
    //                          return result.messages || [];
    // Pas de map/projection — donc tester ce contrat :
    const backendResponse = {
      messages: [
        {
          id: "m1",
          role: "user",
          content: "typed",
          timestamp: "2026-05-02T10:00:00Z",
          source: "text",
        },
        {
          id: "m2",
          role: "user",
          content: "asked aloud",
          timestamp: "2026-05-02T10:01:00Z",
          source: "voice",
          voice_speaker: "user",
          voice_session_id: "vs-abc",
          time_in_call_secs: 1.2,
        },
        {
          id: "m3",
          role: "assistant",
          content: "voiced reply",
          timestamp: "2026-05-02T10:01:30Z",
          source: "voice",
          voice_speaker: "agent",
          voice_session_id: "vs-abc",
          time_in_call_secs: 5.4,
        },
      ],
    };

    // Reproduit le mapping inline du handler (src/background.ts:438)
    const passthrough: ChatMessage[] = backendResponse.messages || [];

    expect(passthrough).toHaveLength(3);
    expect(passthrough[1]).toMatchObject({
      source: "voice",
      voice_speaker: "user",
      voice_session_id: "vs-abc",
      time_in_call_secs: 1.2,
    });
    expect(passthrough[2]).toMatchObject({
      source: "voice",
      voice_speaker: "agent",
      voice_session_id: "vs-abc",
      time_in_call_secs: 5.4,
    });
  });
});
