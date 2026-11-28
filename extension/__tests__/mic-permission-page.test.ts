/** @jest-environment jsdom */
//
// mic-permission.html : fermée sans autorisation, la fenêtre prévient le side
// panel (MIC_PERMISSION_DISMISSED) pour qu'il n'attende pas pour rien.

import { resetChromeMocks } from "./setup/chrome-api-mock";

const sendMessage = chrome.runtime.sendMessage as unknown as jest.Mock;

// Chaque chargement de la page ajoute un écouteur sur le même `window` jsdom :
// on les retire entre les tests.
const pageListeners: EventListenerOrEventListenerObject[] = [];

function loadPage(): void {
  document.body.innerHTML =
    '<button id="grant-btn">Autoriser</button><div id="status"></div>';
  const spy = jest.spyOn(window, "addEventListener");
  jest.isolateModules(() => {
    require("../src/mic-permission");
  });
  for (const [type, listener] of spy.mock.calls) {
    if (type === "pagehide" && listener) pageListeners.push(listener);
  }
  spy.mockRestore();
}

describe("mic-permission page", () => {
  beforeEach(() => {
    resetChromeMocks();
    sendMessage.mockImplementation(() => Promise.resolve({ success: true }));
    jest.useFakeTimers();
  });

  afterEach(() => {
    for (const listener of pageListeners.splice(0)) {
      window.removeEventListener("pagehide", listener);
    }
    jest.useRealTimers();
  });

  it("reports a window closed without allowing the microphone", () => {
    loadPage();
    window.dispatchEvent(new Event("pagehide"));
    expect(sendMessage).toHaveBeenCalledWith({
      action: "MIC_PERMISSION_DISMISSED",
    });
  });

  it("stays quiet once the microphone is allowed", async () => {
    const stop = jest.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: jest.fn().mockResolvedValue({
          getTracks: () => [{ stop }],
        }),
      },
    });
    jest.spyOn(window, "close").mockImplementation(() => undefined);
    loadPage();

    (document.getElementById("grant-btn") as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    window.dispatchEvent(new Event("pagehide"));

    expect(stop).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith({
      action: "MIC_PERMISSION_GRANTED",
    });
    expect(sendMessage).not.toHaveBeenCalledWith({
      action: "MIC_PERMISSION_DISMISSED",
    });
  });
});
