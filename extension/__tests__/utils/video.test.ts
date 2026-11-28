/**
 * Tests — utils/video.ts::toApiVideoUrl
 *
 * Règle extension : seul l'identifiant de la vidéo part vers l'API. L'URL de
 * l'onglet était envoyée telle quelle (playlist, timestamp, paramètres de
 * partage/suivi « si », « pp », query TikTok…).
 */

import { cleanTabTitle, toApiVideoUrl } from "../../src/utils/video";

describe("cleanTabTitle", () => {
  it.each([
    [
      "(2) Mais qu'est-ce qu'un réseau de neurones ? - YouTube",
      "Mais qu'est-ce qu'un réseau de neurones ?",
    ],
    ["(99+) Cours de physique — YouTube", "Cours de physique"],
    ["Recette du pain | TikTok", "Recette du pain"],
    ["Titre - sous-titre - YouTube", "Titre - sous-titre"],
    ["Ma super vidéo YouTube", "Ma super vidéo YouTube"],
  ])("%s → %s", (raw, expected) => {
    expect(cleanTabTitle(raw)).toBe(expected);
  });

  it("returns an empty string when only the site name remains", () => {
    expect(cleanTabTitle("(3) - YouTube")).toBe("");
    expect(cleanTabTitle("")).toBe("");
  });
});

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
