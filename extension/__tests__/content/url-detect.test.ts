/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://www.youtube.com/watch?v=initial"}
 */

/**
 * Tests for the URL-detector content script.
 *
 * Strategy:
 * - jsdom is configured to start on youtube.com so history.pushState/replaceState
 *   can navigate to other youtube URLs without jsdom's cross-origin SecurityError.
 * - The module registers a MutationObserver and a popstate listener at import
 *   time. Because the jsdom DOM persists across tests in the same file, those
 *   listeners would leak from previous tests and pollute later assertions.
 *   We mitigate this by spying on MutationObserver/addEventListener and tearing
 *   down everything between tests.
 */

describe("content URL detect", () => {
  let messageSpy: jest.Mock;
  let observers: MutationObserver[];
  let popstateHandlers: EventListener[];
  let realMutationObserver: typeof MutationObserver;
  let realAddEventListener: typeof window.addEventListener;

  beforeAll(() => {
    realMutationObserver = window.MutationObserver;
    realAddEventListener = window.addEventListener.bind(window);
  });

  beforeEach(() => {
    jest.resetModules();
    observers = [];
    popstateHandlers = [];
    messageSpy = jest.fn().mockResolvedValue(undefined);
    (global as any).chrome = {
      runtime: { sendMessage: messageSpy },
    };

    // Track any MutationObserver instantiated by the module so we can
    // disconnect it after the test.
    (window as any).MutationObserver = class extends realMutationObserver {
      constructor(cb: MutationCallback) {
        super(cb);
        observers.push(this);
      }
    };

    // Track any popstate listener so we can remove it after the test.
    window.addEventListener = ((
      type: string,
      handler: EventListener,
      opts?: boolean | AddEventListenerOptions,
    ) => {
      if (type === "popstate") popstateHandlers.push(handler);
      return realAddEventListener(type, handler, opts);
    }) as typeof window.addEventListener;

    window.history.replaceState(
      null,
      "",
      "https://www.youtube.com/watch?v=initial",
    );
  });

  afterEach(() => {
    observers.forEach((o) => o.disconnect());
    popstateHandlers.forEach((h) => window.removeEventListener("popstate", h));
    (window as any).MutationObserver = realMutationObserver;
    window.addEventListener = realAddEventListener;
  });

  it("sends URL_CHANGED on initial load", async () => {
    await import("../../src/content/index");
    expect(messageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "URL_CHANGED",
        payload: expect.objectContaining({
          url: "https://www.youtube.com/watch?v=initial",
        }),
      }),
    );
  });

  it("sends URL_CHANGED on popstate when URL changed", async () => {
    await import("../../src/content/index");
    messageSpy.mockClear();
    window.history.pushState(
      null,
      "",
      "https://www.youtube.com/watch?v=newvid",
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(messageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "URL_CHANGED",
        payload: expect.objectContaining({
          url: "https://www.youtube.com/watch?v=newvid",
        }),
      }),
    );
  });

  it("does NOT send when URL is unchanged", async () => {
    await import("../../src/content/index");
    messageSpy.mockClear();
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(messageSpy).not.toHaveBeenCalled();
  });

  it("includes platform=youtube for youtube URLs", async () => {
    await import("../../src/content/index");
    expect(messageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ platform: "youtube" }),
      }),
    );
  });
});
