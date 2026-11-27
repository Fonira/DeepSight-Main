/** @jest-environment jsdom */
//
// Tests — SYNC_AUTH_FROM_WEBSITE (background.ts) : seul le content script du
// site DeepSight peut pousser une session dans l'extension.

import { handleMessage } from "../../src/background";
import { localStore, resetChromeMocks } from "../setup/chrome-api-mock";

const message = {
  action: "SYNC_AUTH_FROM_WEBSITE",
  data: {
    accessToken: "web-access",
    refreshToken: "web-refresh",
    user: { id: 7, plan: "pro" },
  },
} as unknown as Parameters<typeof handleMessage>[0];

function sender(url?: string): chrome.runtime.MessageSender {
  return (url ? { url, tab: { id: 1, url } } : {}) as chrome.runtime.MessageSender;
}

describe("SYNC_AUTH_FROM_WEBSITE", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it("stores the session sent from the DeepSight website", async () => {
    const res = await handleMessage(
      message,
      sender("https://www.deepsightsynthesis.com/dashboard"),
    );
    expect(res).toEqual({ success: true });
    expect(localStore.accessToken).toBe("web-access");
    expect(localStore.refreshToken).toBe("web-refresh");
    expect(localStore.user).toEqual({ id: 7, plan: "pro" });
  });

  it.each([
    ["another site", "https://www.youtube.com/watch?v=abc"],
    ["a look-alike host", "https://www.deepsightsynthesis.com.evil.example/"],
    ["no sender", undefined],
  ])("rejects tokens coming from %s", async (_label, url) => {
    const res = await handleMessage(message, sender(url));
    expect(res).toMatchObject({ success: false });
    expect(localStore.accessToken).toBeUndefined();
  });
});
