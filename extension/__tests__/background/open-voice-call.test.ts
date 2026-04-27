/** @jest-environment jsdom */
//
// Tests — `OPEN_VOICE_CALL` handler in background.ts
//
// L'handler doit :
//  1. Stocker le contexte de l'appel dans `chrome.storage.session.pendingVoiceCall`
//     (clé éphémère, vidée au reboot Chrome — sécurité)
//  2. Ouvrir le side panel sur la fenêtre source.
//
// Note : on injecte ici les mocks `chrome.storage.session` et `chrome.sidePanel`
// car le mock global ne les fournit pas (APIs Chrome 102+/114+ optionnelles).

import { handleMessage } from "../../src/background";

describe("OPEN_VOICE_CALL handler", () => {
  beforeEach(() => {
    const c = global as unknown as {
      chrome: {
        storage: { session?: { set: jest.Mock; remove?: jest.Mock } };
        sidePanel?: { open: jest.Mock; setOptions?: jest.Mock };
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

  it("opens side panel and stores videoId+videoTitle", async () => {
    await handleMessage(
      {
        type: "OPEN_VOICE_CALL",
        videoId: "abc",
        videoTitle: "Test",
      } as unknown as Parameters<typeof handleMessage>[0],
      { tab: { id: 42, windowId: 7 } } as chrome.runtime.MessageSender,
    );

    expect(chrome.storage.session!.set).toHaveBeenCalledWith({
      pendingVoiceCall: { videoId: "abc", videoTitle: "Test" },
    });
    expect(chrome.sidePanel!.open).toHaveBeenCalledWith({ windowId: 7 });
  });

  it("no-op when sender has no tab.windowId", async () => {
    await handleMessage(
      {
        type: "OPEN_VOICE_CALL",
        videoId: "abc",
        videoTitle: "Test",
      } as unknown as Parameters<typeof handleMessage>[0],
      {} as chrome.runtime.MessageSender,
    );

    expect(chrome.sidePanel!.open).not.toHaveBeenCalled();
    expect(chrome.storage.session!.set).not.toHaveBeenCalled();
  });
});
