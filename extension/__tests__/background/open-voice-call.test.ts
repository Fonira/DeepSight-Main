/** @jest-environment jsdom */
//
// Tests — `OPEN_VOICE_CALL` handler in background.ts
//
// L'handler doit :
//  1. Stocker le contexte de l'appel dans `chrome.storage.session.pendingVoiceCall`
//     (clé éphémère, vidée au reboot Chrome — sécurité), même sans fenêtre
//     cible : un side panel déjà ouvert le récupère via storage.onChanged.
//  2. Ouvrir le side panel sur la fenêtre source, ou sur la fenêtre courante
//     quand l'appel vient du side panel lui-même (pas de `sender.tab`).
//
//  3. Ne rien faire si la voix n'est pas utilisable (absente du build, ou
//     `voice_available` absent/faux sur le user stocké) : un bouton resté
//     affiché sur un vieil onglet ne doit pas ouvrir d'appel.
//
// Note : on injecte ici les mocks `chrome.storage.session` et `chrome.sidePanel`
// car le mock global ne les fournit pas (APIs Chrome 102+/114+ optionnelles).

import { handleMessage } from "../../src/background";
import { FEATURES } from "../../src/utils/features";
import { resetChromeMocks, seedLocalStorage } from "../setup/chrome-api-mock";

const voiceUser = {
  id: 1,
  email: "x@y.z",
  username: "x",
  plan: "pro",
  credits: 0,
  credits_monthly: 0,
  voice_available: true,
};

describe("OPEN_VOICE_CALL handler", () => {
  beforeEach(() => {
    resetChromeMocks();
    seedLocalStorage({ accessToken: "tok", user: voiceUser });
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

  describe("sender without a tab (side panel caller)", () => {
    const g = global as unknown as {
      chrome: { windows?: { getCurrent?: jest.Mock } };
    };

    afterEach(() => {
      delete g.chrome.windows;
    });

    it("opens the side panel on the current window", async () => {
      g.chrome.windows = { getCurrent: jest.fn().mockResolvedValue({ id: 3 }) };

      await handleMessage(
        {
          type: "OPEN_VOICE_CALL",
          videoId: "abc",
          videoTitle: "Test",
        } as unknown as Parameters<typeof handleMessage>[0],
        {} as chrome.runtime.MessageSender,
      );

      expect(chrome.storage.session!.set).toHaveBeenCalledWith({
        pendingVoiceCall: { videoId: "abc", videoTitle: "Test" },
      });
      expect(chrome.sidePanel!.open).toHaveBeenCalledWith({ windowId: 3 });
    });

    it("only stores the pending call when no window can be resolved", async () => {
      await handleMessage(
        {
          type: "OPEN_VOICE_CALL",
          videoId: "abc",
          videoTitle: "Test",
        } as unknown as Parameters<typeof handleMessage>[0],
        {} as chrome.runtime.MessageSender,
      );

      expect(chrome.storage.session!.set).toHaveBeenCalledWith({
        pendingVoiceCall: { videoId: "abc", videoTitle: "Test" },
      });
      expect(chrome.sidePanel!.open).not.toHaveBeenCalled();
    });
  });

  describe("voix indisponible", () => {
    const open = () =>
      handleMessage(
        {
          type: "OPEN_VOICE_CALL",
          videoId: "abc",
          videoTitle: "Test",
        } as unknown as Parameters<typeof handleMessage>[0],
        { tab: { id: 42, windowId: 7 } } as chrome.runtime.MessageSender,
      );

    it("refuses the call when the API does not report voice", async () => {
      seedLocalStorage({ user: { ...voiceUser, voice_available: false } });

      const res = await open();

      expect(res).toEqual({ success: false, error: "voice_unavailable" });
      expect(chrome.storage.session!.set).not.toHaveBeenCalled();
      expect(chrome.sidePanel!.open).not.toHaveBeenCalled();
    });

    it("refuses the call in a build without voice", async () => {
      FEATURES.voice = false;
      try {
        const res = await open();
        expect(res).toEqual({ success: false, error: "voice_unavailable" });
        expect(chrome.storage.session!.set).not.toHaveBeenCalled();
      } finally {
        FEATURES.voice = true;
      }
    });
  });
});
