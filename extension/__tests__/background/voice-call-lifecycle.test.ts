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

  beforeEach(() => {
    resetChromeMocks();
    tabsSendMessageMock = jest.fn().mockResolvedValue(undefined);
    chrome.tabs.sendMessage =
      tabsSendMessageMock as unknown as typeof chrome.tabs.sendMessage;
  });

  describe("VOICE_CALL_STARTED", () => {
    it("relays DUCK_AUDIO to the sender tab when senderTabId is provided", async () => {
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

    it("does not crash when sender has no tab.id (e.g. sidepanel-direct)", async () => {
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

      // Pas de throw, juste success silent (le call vocal continue même
      // si l'onglet YouTube source est fermé).
      expect(res.success).toBe(true);
    });
  });

  describe("VOICE_CALL_ENDED", () => {
    it("relays RESTORE_AUDIO to the sender tab when senderTabId is provided", async () => {
      const res = await handleMessage(
        { type: "VOICE_CALL_ENDED" } as unknown as Parameters<
          typeof handleMessage
        >[0],
        { tab: { id: 42, windowId: 7 } } as chrome.runtime.MessageSender,
      );

      expect(res.success).toBe(true);
      expect(tabsSendMessageMock).toHaveBeenCalledWith(42, {
        type: "RESTORE_AUDIO",
      });
    });

    it("does not crash when sender has no tab.id", async () => {
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

      // Pas de throw — l'utilisateur a fermé l'onglet YT, le call s'est
      // quand même terminé proprement côté ElevenLabs.
      expect(res.success).toBe(true);
    });
  });
});
