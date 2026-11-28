/** @jest-environment jsdom */
//
// Accès micro avant un appel : dans le side panel, getUserMedia n'affiche pas
// la demande de Chrome de façon fiable. On passe par la fenêtre
// mic-permission.html quand la permission n'est pas encore accordée.

import { ensureMicPermission } from "../../src/sidepanel/micPermission";
import {
  messageListeners,
  resetChromeMocks,
} from "../setup/chrome-api-mock";

interface FakeStatus {
  state: PermissionState;
  onchange: (() => void) | null;
}

function mockPermission(state: PermissionState | "unsupported"): FakeStatus {
  const status: FakeStatus = {
    state: state === "unsupported" ? "prompt" : state,
    onchange: null,
  };
  const query =
    state === "unsupported"
      ? jest.fn().mockRejectedValue(new TypeError("unsupported"))
      : jest.fn().mockResolvedValue(status);
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: { query },
  });
  return status;
}

function deliver(message: unknown): void {
  for (const listener of [...messageListeners]) {
    listener(message, {}, () => undefined);
  }
}

const sendMessage = chrome.runtime.sendMessage as unknown as jest.Mock;

describe("ensureMicPermission", () => {
  beforeEach(() => {
    resetChromeMocks();
    sendMessage.mockImplementation(() => Promise.resolve({ success: true }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns at once when the microphone is already allowed", async () => {
    mockPermission("granted");
    await expect(ensureMicPermission()).resolves.toBe("granted");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does not open the window when the microphone is blocked", async () => {
    mockPermission("denied");
    await expect(ensureMicPermission()).resolves.toBe("denied");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("opens the permission window and waits for its answer", async () => {
    mockPermission("prompt");
    const outcome = ensureMicPermission();
    await Promise.resolve();
    await Promise.resolve();

    expect(sendMessage).toHaveBeenCalledWith({
      action: "OPEN_MIC_PERMISSION_POPUP",
    });
    deliver({ action: "MIC_PERMISSION_GRANTED" });

    await expect(outcome).resolves.toBe("granted");
    expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalled();
  });

  it("also works without the Permissions API", async () => {
    mockPermission("unsupported");
    const outcome = ensureMicPermission();
    await Promise.resolve();
    await Promise.resolve();
    deliver({ action: "MIC_PERMISSION_GRANTED_BROADCAST" });
    await expect(outcome).resolves.toBe("granted");
  });

  it("stops waiting when the window is closed without allowing", async () => {
    mockPermission("prompt");
    const outcome = ensureMicPermission();
    await Promise.resolve();
    await Promise.resolve();
    deliver({ action: "MIC_PERMISSION_DISMISSED" });
    await expect(outcome).resolves.toBe("dismissed");
  });

  it("follows a permission change made in the Chrome prompt", async () => {
    const status = mockPermission("prompt");
    const outcome = ensureMicPermission();
    await Promise.resolve();
    await Promise.resolve();
    status.state = "denied";
    status.onchange?.();
    await expect(outcome).resolves.toBe("denied");
    expect(status.onchange).toBeNull();
  });

  it("gives up after the timeout", async () => {
    jest.useFakeTimers();
    mockPermission("prompt");
    const outcome = ensureMicPermission(1000);
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(1000);
    await expect(outcome).resolves.toBe("dismissed");
  });

  it("gives up when the window cannot be opened", async () => {
    mockPermission("prompt");
    sendMessage.mockImplementation(() =>
      Promise.resolve({ success: false, error: "popup open failed" }),
    );
    await expect(ensureMicPermission()).resolves.toBe("dismissed");
  });
});
