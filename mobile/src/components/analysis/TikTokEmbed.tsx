import React from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

interface TikTokEmbedProps {
  videoId: string;
}

/**
 * Inline TikTok embed using the official TikTok embed/v2 iframe page.
 *
 * TikTok's embed URL renders the player + chrome inside a WebView. Native iframe
 * is not available in React Native, so we wrap the embed page in a WebView with
 * a 9:16 aspect ratio container (TikTok = portrait video).
 */
export const TikTokEmbed: React.FC<TikTokEmbedProps> = ({ videoId }) => {
  const embedUrl = `https://www.tiktok.com/embed/v2/${videoId}`;

  return (
    <View testID="tiktok-embed-container" style={styles.container}>
      <WebView
        testID="tiktok-embed-webview"
        source={{ uri: embedUrl }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        // TikTok embed handles its own chrome — disable bounce/overscroll
        bounces={false}
        scrollEnabled={false}
        // Prevent navigating away from the embed inside the WebView
        originWhitelist={["https://*"]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 9 / 16,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
});

export default TikTokEmbed;
