/**
 * analytics.test.ts — POST /api/analytics/events n'accepte que les noms de sa liste
 * (backend/src/analytics/router.py) et 100 événements max par lot. Un nom inconnu
 * faisait rejeter tout le lot en 422, remis en file indéfiniment.
 */
import {
  ANALYTICS_EVENT_NAMES,
  AnalyticsEngine,
  MAX_EVENTS_PER_REQUEST,
  chunkEvents,
  isAllowedAnalyticsEvent,
  shouldRequeueAfterStatus,
} from "../analytics";
import { trackVoiceEvent } from "../../components/voice/voiceAnalytics";

const mockFetch = jest.fn();
(global as unknown as { fetch: jest.Mock }).fetch = mockFetch;

function sentNames(callIndex: number): string[] {
  const init = mockFetch.mock.calls[callIndex][1] as RequestInit;
  const body = JSON.parse(init.body as string) as { events: Array<{ name: string }> };
  return body.events.map((event) => event.name);
}

describe("liste autorisée", () => {
  it("contient exactement les noms acceptés par le backend", () => {
    expect([...ANALYTICS_EVENT_NAMES].sort()).toEqual(
      [
        "analysis_completed",
        "analysis_deleted",
        "analysis_failed",
        "analysis_started",
        "app_backgrounded",
        "app_opened",
        "chat_message_sent",
        "export_requested",
        "factcheck_requested",
        "favorite_toggled",
        "flashcard_generated",
        "login",
        "logout",
        "mindmap_generated",
        "notification_received",
        "notification_tapped",
        "payment_cancel_reason",
        "quiz_generated",
        "register",
        "screen_viewed",
        "search_performed",
        "share_intent_received",
        "share_link_created",
        "study_content_generated",
        "tab_switched",
        "upgrade_checkout_started",
        "upgrade_cta_clicked",
        "upgrade_cta_viewed",
        "upgrade_plan_selected",
        "video_deleted",
      ].sort(),
    );
    expect(isAllowedAnalyticsEvent("login")).toBe(true);
    expect(isAllowedAnalyticsEvent("voice_chat_error")).toBe(false);
  });

  it("les événements voice_chat_* ne partent pas tant que le backend les refuse", () => {
    expect(trackVoiceEvent("voice_chat_error", { error_type: "mic" })).toBe(false);
  });
});

describe("chunkEvents / shouldRequeueAfterStatus", () => {
  it("découpe en lots de 100 maximum", () => {
    const events = Array.from({ length: 250 }, (_, i) => i);
    const chunks = chunkEvents(events);
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50]);
    expect(MAX_EVENTS_PER_REQUEST).toBe(100);
  });

  it("abandonne un lot refusé en 4xx, garde 408/429/5xx", () => {
    expect(shouldRequeueAfterStatus(422)).toBe(false);
    expect(shouldRequeueAfterStatus(400)).toBe(false);
    expect(shouldRequeueAfterStatus(408)).toBe(true);
    expect(shouldRequeueAfterStatus(429)).toBe(true);
    expect(shouldRequeueAfterStatus(503)).toBe(true);
  });
});

describe("AnalyticsEngine.flush", () => {
  beforeEach(() => mockFetch.mockReset());

  it("n'envoie jamais un nom hors liste", async () => {
    const engine = new AnalyticsEngine();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    (engine.track as (name: string) => void)("voice_chat_started");
    engine.track("login");
    await engine.flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(sentNames(0)).toEqual(["login"]);
  });

  it("un lot rejeté en 422 n'est pas renvoyé en boucle", async () => {
    const engine = new AnalyticsEngine();
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422 });

    engine.track("logout");
    await engine.flush();
    await engine.flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("un lot en 503 est conservé pour le prochain envoi", async () => {
    const engine = new AnalyticsEngine();
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    engine.track("register");
    await engine.flush();
    await engine.flush();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(sentNames(1)).toEqual(["register"]);
  });
});
