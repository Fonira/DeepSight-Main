import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// react-native-reanimated needs a SharedValue we can drive from tests
const makeSharedValue = (value = 0) => ({ value });

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View: React.forwardRef((props: { style?: unknown; children?: React.ReactNode }, ref) =>
        React.createElement(View, { ...props, ref }, props.children),
      ),
    },
    View: React.forwardRef((props: { style?: unknown; children?: React.ReactNode }, ref) =>
      React.createElement(View, { ...props, ref }, props.children),
    ),
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    interpolate: (
      _value: number,
      _input: number[],
      output: number[],
    ) => output[0],
    Easing: {
      bezier: () => ({}),
    },
  };
});

// react-native-youtube-iframe — render a placeholder we can find by testID.
// Override any testID prop coming from the component so tests can locate the
// embed reliably regardless of internal naming changes.
jest.mock("react-native-youtube-iframe", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: { videoId?: string; height?: number }) =>
      React.createElement(View, {
        ...props,
        testID: "mock-youtube-iframe",
      }),
  };
});

// react-native-webview (used by TikTokEmbed)
jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockWebView = (props: { source?: { uri?: string }; testID?: string }) =>
    React.createElement(View, {
      ...props,
      testID: props.testID ?? "mock-webview",
    });
  return {
    __esModule: true,
    WebView: MockWebView,
    default: MockWebView,
  };
});

jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    Image: (props: { source?: { uri?: string }; testID?: string }) =>
      React.createElement(View, {
        ...props,
        testID: props.testID ?? "expo-image",
      }),
  };
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Ionicons: (props: { name?: string }) =>
      React.createElement(Text, {}, props.name),
  };
});

jest.mock("../../../src/contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: "#0D0D0F",
      bgSecondary: "#141416",
      bgTertiary: "#1A1A1D",
      textPrimary: "#FFFFFF",
      textSecondary: "#B8B8C0",
      textTertiary: "#8E8E96",
      textMuted: "#5E5E66",
      border: "#2A2A2F",
      accentPrimary: "#7C3AED",
      accentInfo: "#3B82F6",
    },
  }),
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import { VideoPlayer } from "../../../src/components/analysis/VideoPlayer";

const baseProps = {
  scrollY: makeSharedValue(0) as never,
  title: "Test video",
};

describe("VideoPlayer — conditional render", () => {
  it("renders null when there is no videoId", () => {
    const { toJSON } = render(
      <VideoPlayer {...baseProps} videoId="" platform="youtube" />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders null when YouTube videoId is invalid (not 11 chars)", () => {
    const { toJSON } = render(
      <VideoPlayer {...baseProps} videoId="abc" platform="youtube" />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders null when YouTube videoId contains forbidden characters", () => {
    const { toJSON } = render(
      <VideoPlayer
        {...baseProps}
        videoId="!!!invalid!!"
        platform="youtube"
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders null when TikTok platform but no thumbnail", () => {
    const { toJSON } = render(
      <VideoPlayer
        {...baseProps}
        videoId="7311234567890123456"
        platform="tiktok"
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders null when platform is text or unknown", () => {
    const { toJSON } = render(
      <VideoPlayer
        {...baseProps}
        videoId="abc"
        platform={"text" as never}
      />,
    );
    expect(toJSON()).toBeNull();
  });
});

describe("VideoPlayer — compact mode", () => {
  it("renders compact mode with valid 11-char YouTube videoId", () => {
    const { getByTestId } = render(
      <VideoPlayer
        {...baseProps}
        videoId="dQw4w9WgXcQ"
        platform="youtube"
      />,
    );
    expect(getByTestId("video-player-compact")).toBeTruthy();
  });

  it("renders compact mode for TikTok with thumbnail URL provided", () => {
    const { getByTestId } = render(
      <VideoPlayer
        {...baseProps}
        videoId="7311234567890123456"
        platform="tiktok"
        thumbnail="https://p16-tiktok.tiktokcdn.com/.../thumb.jpeg"
      />,
    );
    expect(getByTestId("video-player-compact")).toBeTruthy();
  });

  it("uses the YouTube hqdefault thumbnail URL for YouTube videos", () => {
    const { getByTestId } = render(
      <VideoPlayer
        {...baseProps}
        videoId="dQw4w9WgXcQ"
        platform="youtube"
      />,
    );
    const thumb = getByTestId("video-player-thumbnail");
    expect(thumb.props.source.uri).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
  });

  it("uses the provided thumbnail URL for TikTok videos", () => {
    const tikTokThumb = "https://p16-tiktok.tiktokcdn.com/.../thumb.jpeg";
    const { getByTestId } = render(
      <VideoPlayer
        {...baseProps}
        videoId="7311234567890123456"
        platform="tiktok"
        thumbnail={tikTokThumb}
      />,
    );
    const thumb = getByTestId("video-player-thumbnail");
    expect(thumb.props.source.uri).toBe(tikTokThumb);
  });
});

describe("VideoPlayer — tap-to-expand", () => {
  it("expands to YouTube embed mode when compact thumbnail is tapped", () => {
    const { getByTestId, queryByTestId } = render(
      <VideoPlayer
        {...baseProps}
        videoId="dQw4w9WgXcQ"
        platform="youtube"
      />,
    );
    // Initially compact, no embed
    expect(queryByTestId("mock-youtube-iframe")).toBeNull();

    fireEvent.press(getByTestId("video-player-compact-pressable"));

    // After tap → embed visible
    expect(getByTestId("mock-youtube-iframe")).toBeTruthy();
  });

  it("expands to TikTok embed (WebView) when compact thumbnail is tapped", () => {
    const { getByTestId, queryByTestId } = render(
      <VideoPlayer
        {...baseProps}
        videoId="7311234567890123456"
        platform="tiktok"
        thumbnail="https://p16-tiktok.tiktokcdn.com/.../thumb.jpeg"
      />,
    );
    expect(queryByTestId("tiktok-embed-webview")).toBeNull();

    fireEvent.press(getByTestId("video-player-compact-pressable"));

    expect(getByTestId("tiktok-embed-webview")).toBeTruthy();
  });

  it("collapses back to compact mode when close button is pressed", () => {
    const { getByTestId, queryByTestId } = render(
      <VideoPlayer
        {...baseProps}
        videoId="dQw4w9WgXcQ"
        platform="youtube"
      />,
    );

    // Expand
    fireEvent.press(getByTestId("video-player-compact-pressable"));
    expect(getByTestId("mock-youtube-iframe")).toBeTruthy();

    // Close
    fireEvent.press(getByTestId("video-player-close"));

    // Back to compact, no embed
    expect(queryByTestId("mock-youtube-iframe")).toBeNull();
    expect(getByTestId("video-player-compact")).toBeTruthy();
  });
});
