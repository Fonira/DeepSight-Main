/** @jest-environment jsdom */
//
// Tests — handlers VOICE_CALL_STARTED / VOICE_CALL_ENDED dans background.ts
//
// Ces messages sont émis par le sidepanel (VoiceView) au démarrage et
// fin d'appel. Le background relaye un message DUCK_AUDIO / RESTORE_AUDIO
// vers l'onglet émetteur (sender tab) qui contient le content script
// `youtubeAudioController`. Sans ce relais, l'audio YouTube continue à
// jouer par-dessus l'agent vocal.
//
// Cible le finding [I1] de l'audit Quick Voice Call.

import { handleMessage } from "../../src/background";
import { resetChromeMocks } from "../setup/chrome-api-mock";

describe("VOICE_CALL_STARTED / VOICE_CALL_ENDED handlers", () => {
  let tabsSendMessageMock: jest.Mock;
  let tabsQueryMock: jest.Mock;

  beforeEach(() => {
    resetChromeMocks();
    tabsSendMessageMock = jest.fn().mockResolvedValue(undefined);
    chrome.tabs.sendMessage =
      tabsSendMessageMock as unknown as typeof chrome.tabs.sendMessage;
    // [N6] : broadcast multi-tab — par défaut, le mock chrome.tabs.query
    // renvoie 1 tab YouTube (id=1), géré par le mock global.
    tabsQueryMock = jest
      .fn()
      .mockResolvedValue([
        { id: 1, url: "https://www.youtube.com/watch?v=abc" },
      ]);
    chrome.tabs.query = tabsQueryMock as unknown as typeof chrome.tabs.query;
  });

  describe("VOICE_CALL_STARTED", () => {
    it("[N6] broadcasts DUCK_AUDIO to all YouTube tabs", async () => {
      // 2 tabs YouTube ouverts — broadcast doit toucher les 2.
      tabsQueryMock.mockResolvedValueOnce([
        { id: 11, url: "https://www.youtube.com/watch?v=a" },
        { id: 22, url: "https://www.youtube.com/watch?v=b" },
      ]);

      const res = await handleMessage(
        { type: "VOICE_CALL_STARTED" } as unknown as Parameters<
          typeof handleMessage
        >[0],
        { tab: { id: 11, windowId: 7 } } as chrome.runtime.MessageSender,
      );

      expect(res.success).toBe(true);
      expect(tabsSendMessageMock).toHaveBeenCalledWith(11, {
        type: "DUCK_AUDIO",
      });
      expect(tabsSendMessageMock).toHaveBeenCalledWith(22, {
        type: "DUCK_AUDIO",
      });
    });

    it("includes sender tab even if not in query result", async () => {
      tabsQueryMock.mockResolvedValueOnce([]); // query returns empty

      const res = await handleMessage(
        { type: "VOICE_CALL_STARTED" } as unknown as Parameters<
          typeof handleMessage
        >[0],
        { tab: { id: 42, windowId: 7 } } as chrome.runtime.MessageSender,
      );

      expect(res.success).toBe(true);
      expect(tabsSendMessageMock).toHaveBeenCalledWith(42, {
        type: "DUCK_AUDIO",
      });
    });

    it("does not crash when sender has no tab.id and no YT tabs open", async () => {
      tabsQueryMock.mockResolvedValueOnce([]);

      const res = await handleMessage(
        { type: "VOICE_CALL_STARTED" } as unknown as Parameters<
          typeof handleMessage
        >[0],
        {} as chrome.runtime.MessageSender,
      );

      expect(res.success).toBe(true);
      expect(tabsSendMessageMock).not.toHaveBeenCalled();
    });

    it("swallows tabs.sendMessage rejection silently (tab may have closed)", async () => {
      tabsSendMessageMock.mockRejectedValue(new Error("Tab gone"));

      const res = await handleMessage(
        { type: "VOICE_CALL_STARTED" } as unknown as Parameters<
          typeof handleMessage
        >[0],
        { tab: { id: 99, windowId: 1 } } as chrome.runtime.MessageSender,
      );

      // Pas de throw, juste success silent.
      expect(res.success).toBe(true);
    });
  });

  describe("VOICE_CALL_ENDED", () => {
    it("[N6] broadcasts RESTORE_AUDIO to all YouTube tabs", async () => {
      tabsQueryMock.mockResolvedValueOnce([
        { id: 11, url: "https://www.youtube.com/watch?v=a" },
        { id: 22, url: "https://www.youtube.com/watch?v=b" },
      ]);

      const res = await handleMessage(
        { type: "VOICE_CALL_ENDED" } as unknown as Parameters<
          typeof handleMessage
        >[0],
        { tab: { id: 11, windowId: 7 } } as chrome.runtime.MessageSender,
      );

      expect(res.success).toBe(true);
      expect(tabsSendMessageMock).toHaveBeenCalledWith(11, {
        type: "RESTORE_AUDIO",
      });
      expect(tabsSendMessageMock).toHaveBeenCalledWith(22, {
        type: "RESTORE_AUDIO",
      });
    });

    it("does not crash when sender has no tab.id and no YT tabs", async () => {
      tabsQueryMock.mockResolvedValueOnce([]);

      const res = await handleMessage(
        { type: "VOICE_CALL_ENDED" } as unknown as Parameters<
          typeof handleMessage
        >[0],
        {} as chrome.runtime.MessageSender,
      );

      expect(res.success).toBe(true);
      expect(tabsSendMessageMock).not.toHaveBeenCalled();
    });

    it("swallows tabs.sendMessage rejection silently (tab closed mid-call)", async () => {
      tabsSendMessageMock.mockRejectedValue(new Error("Tab gone"));

      const res = await handleMessage(
        { type: "VOICE_CALL_ENDED" } as unknown as Parameters<
          typeof handleMessage
        >[0],
        { tab: { id: 99, windowId: 1 } } as chrome.runtime.MessageSender,
      );

      expect(res.success).toBe(true);
    });
  });
});
