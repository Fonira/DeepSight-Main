import React from "react";
import { render } from "@testing-library/react-native";

// Mock react-native-webview before component import
jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockWebView = (props: { source?: { uri?: string }; style?: unknown; testID?: string }) =>
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

import { TikTokEmbed } from "../../../src/components/analysis/TikTokEmbed";

describe("TikTokEmbed", () => {
  it("renders a WebView with the TikTok embed URL for the given videoId", () => {
    const { getByTestId } = render(<TikTokEmbed videoId="7311234567890123456" />);
    const webview = getByTestId("tiktok-embed-webview");
    expect(webview).toBeTruthy();
    // The source.uri prop should resolve to the TikTok embed v2 URL
    expect(webview.props.source.uri).toBe(
      "https://www.tiktok.com/embed/v2/7311234567890123456",
    );
  });

  it("applies a 9:16 aspect ratio container style", () => {
    const { getByTestId } = render(<TikTokEmbed videoId="7311234567890123456" />);
    const container = getByTestId("tiktok-embed-container");
    expect(container).toBeTruthy();
    // Style should declare aspectRatio 9 / 16 (portrait)
    const styles = Array.isArray(container.props.style)
      ? Object.assign({}, ...container.props.style.filter(Boolean))
      : container.props.style;
    expect(styles.aspectRatio).toBeCloseTo(9 / 16, 4);
  });
});
