import { renderHook, act, waitFor } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import { useClipboardURLDetector } from "../../src/hooks/useClipboardURLDetector";

jest.mock("expo-clipboard");
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb) => {
    cb();
  },
}));

describe("useClipboardURLDetector", () => {
  beforeEach(() => jest.clearAllMocks());

  test("detects YouTube URL in clipboard on focus", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue(
      "https://youtu.be/dQw4w9WgXcQ",
    );
    const { result } = renderHook(() => useClipboardURLDetector());
    await waitFor(() => {
      expect(result.current.clipboardURL).toBe("https://youtu.be/dQw4w9WgXcQ");
    });
  });

  test("ignores non-video URLs", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue(
      "https://example.com",
    );
    const { result } = renderHook(() => useClipboardURLDetector());
    await waitFor(() => {
      expect(result.current.clipboardURL).toBeNull();
    });
  });

  test("ignores empty clipboard", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue("");
    const { result } = renderHook(() => useClipboardURLDetector());
    await waitFor(() => {
      expect(result.current.clipboardURL).toBeNull();
    });
  });

  test("dismiss clears the state", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue(
      "https://www.tiktok.com/@u/video/7123456789012345678",
    );
    const { result } = renderHook(() => useClipboardURLDetector());
    await waitFor(() => expect(result.current.clipboardURL).toBeTruthy());
    act(() => result.current.dismiss());
    expect(result.current.clipboardURL).toBeNull();
  });
});
