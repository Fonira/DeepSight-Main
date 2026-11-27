/** @jest-environment jsdom */
//
// Tests — onboarding post-installation (background.ts).

import "../../src/background";

type InstalledListener = (details: { reason: string }) => unknown;

describe("runtime.onInstalled", () => {
  const listeners = (
    chrome.runtime.onInstalled.addListener as jest.Mock
  ).mock.calls.map(([cb]) => cb as InstalledListener);

  beforeEach(() => {
    (chrome.tabs.create as jest.Mock).mockClear();
  });

  it("opens the website's extension welcome page on first install", async () => {
    await Promise.all(listeners.map((cb) => cb({ reason: "install" })));
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "https://www.deepsightsynthesis.com/extension-welcome",
    });
  });

  it("does not open a tab on update", async () => {
    await Promise.all(listeners.map((cb) => cb({ reason: "update" })));
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });
});
