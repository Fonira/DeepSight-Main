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
});
