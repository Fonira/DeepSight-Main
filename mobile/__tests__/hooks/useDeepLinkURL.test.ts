import { renderHook, act, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { useDeepLinkURL } from "../../src/hooks/useDeepLinkURL";

jest.mock("expo-linking", () => ({
  __esModule: true,
  parse: jest.fn(),
  getInitialURL: jest.fn(),
  addEventListener: jest.fn(),
}));

jest.mock("expo-share-intent/build/useShareIntent", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    isReady: true,
    hasShareIntent: false,
    shareIntent: { text: null, webUrl: null, type: null, files: null, meta: null },
    resetShareIntent: jest.fn(),
    error: null,
  }),
}));

describe("useDeepLinkURL", () => {
  let urlListener: ((evt: { url: string }) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    urlListener = null;
    (Linking.addEventListener as jest.Mock).mockImplementation((event, cb) => {
      urlListener = cb;
      return { remove: jest.fn() };
    });
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(null);
    (Linking.parse as jest.Mock).mockImplementation((url: string) => {
      const m = url.match(
        /deepsight:\/\/voice-call\?url=([^&]+)(?:&autostart=(\w+))?/
      );
      if (m) {
        return {
          path: "voice-call",
          queryParams: {
            url: decodeURIComponent(m[1]),
            autostart: m[2] || "false",
          },
        };
      }
      const settingsMatch = url.match(/deepsight:\/\/settings/);
      if (settingsMatch) {
        return { path: "settings", queryParams: {} };
      }
      return { path: null, queryParams: {} };
    });
  });

  test("calls onURL with valid YouTube deep link + autostart=true", async () => {
    const onURL = jest.fn();
    renderHook(() => useDeepLinkURL(onURL));
    await waitFor(() => expect(urlListener).not.toBeNull());

    act(() => {
      urlListener!({
        url: `deepsight://voice-call?url=${encodeURIComponent(
          "https://youtu.be/dQw4w9WgXcQ"
        )}&autostart=true`,
      });
    });

    expect(onURL).toHaveBeenCalledWith("https://youtu.be/dQw4w9WgXcQ", true);
  });

  test("calls onURL with autostart=false when not specified", async () => {
    const onURL = jest.fn();
    renderHook(() => useDeepLinkURL(onURL));
    await waitFor(() => expect(urlListener).not.toBeNull());

    act(() => {
      urlListener!({
        url: `deepsight://voice-call?url=${encodeURIComponent(
          "https://youtu.be/dQw4w9WgXcQ"
        )}`,
      });
    });

    expect(onURL).toHaveBeenCalledWith("https://youtu.be/dQw4w9WgXcQ", false);
  });

  test("ignores non-voice-call paths", async () => {
    const onURL = jest.fn();
    renderHook(() => useDeepLinkURL(onURL));
    await waitFor(() => expect(urlListener).not.toBeNull());
    act(() => {
      urlListener!({ url: "deepsight://settings" });
    });
    expect(onURL).not.toHaveBeenCalled();
  });

  test("ignores invalid URL in deep link", async () => {
    const onURL = jest.fn();
    renderHook(() => useDeepLinkURL(onURL));
    await waitFor(() => expect(urlListener).not.toBeNull());
    act(() => {
      urlListener!({
        url: `deepsight://voice-call?url=${encodeURIComponent(
          "https://vimeo.com/1"
        )}&autostart=true`,
      });
    });
    expect(onURL).not.toHaveBeenCalled();
  });

  test("processes initial URL on mount", async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(
      `deepsight://voice-call?url=${encodeURIComponent(
        "https://youtu.be/dQw4w9WgXcQ"
      )}&autostart=true`
    );
    const onURL = jest.fn();
    renderHook(() => useDeepLinkURL(onURL));
    await waitFor(() => expect(onURL).toHaveBeenCalled());
    expect(onURL).toHaveBeenCalledWith("https://youtu.be/dQw4w9WgXcQ", true);
  });

  test("processes TikTok URL via deep link", async () => {
    const onURL = jest.fn();
    renderHook(() => useDeepLinkURL(onURL));
    await waitFor(() => expect(urlListener).not.toBeNull());
    act(() => {
      urlListener!({
        url: `deepsight://voice-call?url=${encodeURIComponent(
          "https://www.tiktok.com/@u/video/7123456789012345678"
        )}&autostart=true`,
      });
    });
    expect(onURL).toHaveBeenCalledWith(
      "https://www.tiktok.com/@u/video/7123456789012345678",
      true
    );
  });
});
