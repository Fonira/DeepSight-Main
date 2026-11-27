/**
 * Tests — utils/video.ts::toApiVideoUrl
 *
 * Règle extension : seul l'identifiant de la vidéo part vers l'API. L'URL de
 * l'onglet était envoyée telle quelle (playlist, timestamp, paramètres de
 * partage/suivi « si », « pp », query TikTok…).
 */

import { toApiVideoUrl } from "../../src/utils/video";

describe("toApiVideoUrl", () => {
  it.each([
    [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=4&t=42s&pp=xyz",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ],
    [
      "https://m.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ],
    [
      "https://youtu.be/dQw4w9WgXcQ?si=trackingToken",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ],
    [
      "https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ],
  ])("reduces %s to the video id", (input, expected) => {
    expect(toApiVideoUrl(input)).toBe(expected);
  });

  it("strips the query string and fragment of TikTok URLs", () => {
    expect(
      toApiVideoUrl(
        "https://www.tiktok.com/@creator/video/7234567890123456789?is_from_webapp=1&sender_device=pc#comments",
      ),
    ).toBe("https://www.tiktok.com/@creator/video/7234567890123456789");
    expect(toApiVideoUrl("https://vm.tiktok.com/ZMabc123/?k=1")).toBe(
      "https://vm.tiktok.com/ZMabc123/",
    );
  });

  it("rejects non-video pages and malformed ids", () => {
    expect(toApiVideoUrl("https://www.youtube.com/feed/subscriptions")).toBeNull();
    expect(toApiVideoUrl("https://www.youtube.com/watch?v=<script>")).toBeNull();
    expect(toApiVideoUrl("https://example.com/@x/video/123")).toBeNull();
    expect(
      toApiVideoUrl("https://evil.example/?next=tiktok.com/@x/video/123"),
    ).toBeNull();
  });
});
