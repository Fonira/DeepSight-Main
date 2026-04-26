// Mock chrome.* APIs needed before importing background
const sidePanelMock = {
  setPanelBehavior: jest.fn().mockResolvedValue(undefined),
  open: jest.fn().mockResolvedValue(undefined),
};
const onInstalledListeners: Array<() => void> = [];
const onActivatedListeners: Array<(info: { tabId: number }) => void> = [];

(global as any).chrome = {
  ...((global as any).chrome ?? {}),
  sidePanel: sidePanelMock,
  runtime: {
    ...((global as any).chrome?.runtime ?? {}),
    onInstalled: {
      addListener: (cb: () => void) => onInstalledListeners.push(cb),
    },
    onStartup: { addListener: jest.fn() },
    sendMessage: jest.fn().mockResolvedValue(undefined),
    onMessage: { addListener: jest.fn() },
    getURL: (path: string) => `chrome-extension://test/${path}`,
  },
  tabs: {
    onActivated: {
      addListener: (cb: (info: { tabId: number }) => void) =>
        onActivatedListeners.push(cb),
    },
    query: jest.fn().mockResolvedValue([]),
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      onChanged: { addListener: jest.fn() },
    },
    onChanged: { addListener: jest.fn() },
  },
  alarms: {
    create: jest.fn(),
    onAlarm: { addListener: jest.fn() },
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
  },
  identity: {
    getRedirectURL: () => "https://test.chromiumapp.org/",
    launchWebAuthFlow: jest.fn(),
  },
};

describe("background — sidePanel toggle wiring", () => {
  beforeEach(() => {
    jest.resetModules();
    sidePanelMock.setPanelBehavior.mockClear();
    ((global as any).chrome.runtime.sendMessage as jest.Mock).mockClear();
    onInstalledListeners.length = 0;
    onActivatedListeners.length = 0;
  });

  it("calls setPanelBehavior({ openPanelOnActionClick: true }) on install", async () => {
    await import("../../src/background");
    expect(onInstalledListeners.length).toBeGreaterThan(0);
    onInstalledListeners.forEach((cb) =>
      (cb as (d: unknown) => void)({ reason: "update" }),
    );
    expect(sidePanelMock.setPanelBehavior).toHaveBeenCalledWith({
      openPanelOnActionClick: true,
    });
  });

  it("relays TAB_CHANGED on tab activation", async () => {
    await import("../../src/background");
    expect(onActivatedListeners.length).toBeGreaterThan(0);
    onActivatedListeners.forEach((cb) => cb({ tabId: 42 }));
    expect((global as any).chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: "TAB_CHANGED", tabId: 42 }),
    );
  });

  it("relays URL_CHANGED to sidebar via VIDEO_URL_UPDATED", async () => {
    // The polyfill mock aliases Browser.runtime.onMessage to chrome.runtime.onMessage,
    // so both the dedicated URL_CHANGED listener and the main switch handler register
    // here. Collect all listeners and dispatch URL_CHANGED to each.
    const listeners: Array<(...args: any[]) => any> = [];
    (global as any).chrome.runtime.onMessage.addListener = jest.fn((cb) => {
      listeners.push(cb);
    });
    await import("../../src/background");
    expect(listeners.length).toBeGreaterThan(0);

    const sendResponse = jest.fn();
    const sender = { tab: { id: 7 } };
    listeners.forEach((fn) =>
      fn(
        {
          action: "URL_CHANGED",
          payload: {
            url: "https://youtube.com/watch?v=abc",
            platform: "youtube",
          },
        },
        sender,
        sendResponse,
      ),
    );

    expect((global as any).chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "VIDEO_URL_UPDATED",
        payload: expect.objectContaining({
          url: "https://youtube.com/watch?v=abc",
        }),
      }),
    );
  });
});
