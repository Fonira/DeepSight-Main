/** @jest-environment jsdom */
//
// Tests — handlers `OPEN_SIDEPANEL_VISUAL` et `OPEN_BILLING_UPSELL` dans
// background.ts. Ces handlers répondent aux messages émis par le badge
// "👁️ Analyse visuelle" injecté sur YouTube par
// `extension/src/content/widget.ts` (renderVisualAnalysisBadge).
//
// Payload émis par le badge :
//   { type: "OPEN_SIDEPANEL_VISUAL" | "OPEN_BILLING_UPSELL",
//     videoId, feature: "visual_analysis", plan }
//
// Comportement attendu :
//  - OPEN_SIDEPANEL_VISUAL : stocke le contexte dans
//    `chrome.storage.session.visualPanelContext` et ouvre le side panel
//    sur le tab d'origine.
//  - OPEN_BILLING_UPSELL : ouvre `${WEBAPP_URL}/pricing?...` dans un
//    nouvel onglet avec UTM tracking (utm_source=extension,
//    utm_medium=visual_badge, utm_campaign=visual_analysis_upsell, …).
//
// Comme open-voice-call.test.ts, on injecte les mocks chrome.storage.session
// et chrome.sidePanel localement (APIs Chrome 102+/114+ optionnelles).

import { handleMessage } from "../../src/background";

describe("OPEN_SIDEPANEL_VISUAL handler", () => {
  beforeEach(() => {
    const c = global as unknown as {
      chrome: {
        storage: { session?: { set: jest.Mock; remove?: jest.Mock } };
        sidePanel?: { open: jest.Mock; setOptions?: jest.Mock };
        tabs: { create: jest.Mock };
      };
    };
    c.chrome.storage.session = {
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    c.chrome.sidePanel = {
      open: jest.fn().mockResolvedValue(undefined),
      setOptions: jest.fn().mockResolvedValue(undefined),
    };
  });

  it("stores visualPanelContext and opens side panel for paid user", async () => {
    const result = await handleMessage(
      {
        type: "OPEN_SIDEPANEL_VISUAL",
        videoId: "abc",
        feature: "visual_analysis",
        plan: "pro",
      } as unknown as Parameters<typeof handleMessage>[0],
      { tab: { id: 42, windowId: 7 } } as chrome.runtime.MessageSender,
    );

    expect(result).toEqual({ success: true });
    expect(chrome.storage.session!.set).toHaveBeenCalledWith({
      visualPanelContext: {
        videoId: "abc",
        feature: "visual_analysis",
        plan: "pro",
        source: "youtube_badge",
      },
    });
    expect(chrome.sidePanel!.setOptions).toHaveBeenCalledWith({
      tabId: 42,
      path: "sidepanel.html",
      enabled: true,
    });
    expect(chrome.sidePanel!.open).toHaveBeenCalledWith({ tabId: 42 });
  });

  it("returns error when sidePanel API unavailable", async () => {
    const c = global as unknown as { chrome: { sidePanel?: unknown } };
    c.chrome.sidePanel = undefined;

    const result = await handleMessage(
      {
        type: "OPEN_SIDEPANEL_VISUAL",
        videoId: "abc",
        feature: "visual_analysis",
        plan: "expert",
      } as unknown as Parameters<typeof handleMessage>[0],
      { tab: { id: 1, windowId: 1 } } as chrome.runtime.MessageSender,
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Side panel API not available/i);
  });
});

describe("OPEN_BILLING_UPSELL handler", () => {
  beforeEach(() => {
    const c = global as unknown as {
      chrome: { tabs: { create: jest.Mock } };
    };
    c.chrome.tabs.create = jest.fn().mockResolvedValue({ id: 99 });
  });

  it("opens pricing tab with UTM tracking and feature param", async () => {
    const result = await handleMessage(
      {
        type: "OPEN_BILLING_UPSELL",
        videoId: "xyz",
        feature: "visual_analysis",
        plan: "free",
      } as unknown as Parameters<typeof handleMessage>[0],
      { tab: { id: 1, windowId: 1 } } as chrome.runtime.MessageSender,
    );

    expect(result).toEqual({ success: true });
    expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    const calledUrl = (chrome.tabs.create as jest.Mock).mock.calls[0][0]
      .url as string;
    expect(calledUrl).toMatch(
      /^https:\/\/www\.deepsightsynthesis\.com\/pricing\?/,
    );
    const url = new URL(calledUrl);
    expect(url.searchParams.get("utm_source")).toBe("extension");
    expect(url.searchParams.get("utm_medium")).toBe("visual_badge");
    expect(url.searchParams.get("utm_campaign")).toBe(
      "visual_analysis_upsell",
    );
    expect(url.searchParams.get("feature")).toBe("visual_analysis");
    expect(url.searchParams.get("video_id")).toBe("xyz");
    expect(url.searchParams.get("from_plan")).toBe("free");
  });

  it("works without optional videoId/plan", async () => {
    const result = await handleMessage(
      {
        type: "OPEN_BILLING_UPSELL",
        feature: "visual_analysis",
      } as unknown as Parameters<typeof handleMessage>[0],
      { tab: { id: 1, windowId: 1 } } as chrome.runtime.MessageSender,
    );

    expect(result).toEqual({ success: true });
    const calledUrl = (chrome.tabs.create as jest.Mock).mock.calls[0][0]
      .url as string;
    const url = new URL(calledUrl);
    expect(url.searchParams.get("utm_source")).toBe("extension");
    expect(url.searchParams.has("video_id")).toBe(false);
    expect(url.searchParams.has("from_plan")).toBe(false);
  });
});
