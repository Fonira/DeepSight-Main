import { renderHook, act } from "@testing-library/react";
import { useCurrentTab } from "../../../src/sidepanel/hooks/useCurrentTab";

describe("useCurrentTab", () => {
  let messageListener: ((msg: any) => void) | null = null;

  beforeEach(() => {
    messageListener = null;
    (global as any).chrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn((cb) => {
            messageListener = cb;
          }),
          removeListener: jest.fn(),
        },
      },
      tabs: {
        query: jest.fn().mockResolvedValue([
          {
            id: 7,
            url: "https://www.youtube.com/watch?v=initial",
            active: true,
          },
        ]),
      },
    };
  });

  it("returns initial tab info on mount", async () => {
    const { result } = renderHook(() => useCurrentTab());
    await act(async () => {});
    expect(result.current.url).toBe("https://www.youtube.com/watch?v=initial");
    expect(result.current.platform).toBe("youtube");
    expect(result.current.tabId).toBe(7);
  });

  it("updates state when VIDEO_URL_UPDATED received", async () => {
    const { result } = renderHook(() => useCurrentTab());
    await act(async () => {});
    expect(messageListener).not.toBeNull();
    act(() => {
      messageListener!({
        action: "VIDEO_URL_UPDATED",
        payload: {
          url: "https://www.youtube.com/watch?v=newvid",
          platform: "youtube",
        },
      });
    });
    expect(result.current.url).toBe("https://www.youtube.com/watch?v=newvid");
  });

  it("re-queries tabs on TAB_CHANGED", async () => {
    const { result } = renderHook(() => useCurrentTab());
    await act(async () => {});
    ((global as any).chrome.tabs.query as jest.Mock).mockResolvedValueOnce([
      { id: 99, url: "https://www.tiktok.com/@user/video/123", active: true },
    ]);
    expect(messageListener).not.toBeNull();
    await act(async () => {
      messageListener!({ action: "TAB_CHANGED", tabId: 99 });
      // Allow promise from chrome.tabs.query to settle
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.tabId).toBe(99);
    expect(result.current.platform).toBe("tiktok");
  });

  it("returns platform=null for non-video pages", async () => {
    ((global as any).chrome.tabs.query as jest.Mock).mockResolvedValueOnce([
      { id: 1, url: "https://example.com", active: true },
    ]);
    const { result } = renderHook(() => useCurrentTab());
    await act(async () => {});
    expect(result.current.platform).toBeNull();
  });

  it("removes message listener on unmount", () => {
    const { unmount } = renderHook(() => useCurrentTab());
    unmount();
    expect(
      (global as any).chrome.runtime.onMessage.removeListener,
    ).toHaveBeenCalled();
  });
});
