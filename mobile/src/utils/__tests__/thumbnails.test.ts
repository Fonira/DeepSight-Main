/**
 * thumbnails.test.ts — miniatures de l'API relancée (point 6) : URL absolues
 * /api/thumbnails inchangées, anciennes URL relatives « /thumbnails/... » réparées.
 */
jest.mock("../../constants/config", () => ({
  API_BASE_URL: "https://api.deepsightsynthesis.com",
}));

import { resolveThumbnailUrl, youtubeThumbnailUrl } from "../thumbnails";

const ABS =
  "https://api.deepsightsynthesis.com/api/thumbnails/thumbnails/abc123/card.webp";

describe("resolveThumbnailUrl", () => {
  it("garde une URL absolue telle quelle (pas de double préfixe)", () => {
    expect(resolveThumbnailUrl(ABS, { videoId: "abc123" })).toBe(ABS);
    expect(resolveThumbnailUrl("https://p16-sign.tiktokcdn.com/x.jpg")).toBe(
      "https://p16-sign.tiktokcdn.com/x.jpg",
    );
  });

  it("préfixe une URL relative /api/thumbnails par l'API", () => {
    expect(resolveThumbnailUrl("/api/thumbnails/thumbnails/abc123/card.webp")).toBe(ABS);
  });

  it("ancienne URL /thumbnails/... : miniature YouTube si la vidéo est connue", () => {
    expect(
      resolveThumbnailUrl("/thumbnails/abc123/card.webp", {
        videoId: "abc123",
        platform: "youtube",
      }),
    ).toBe("https://img.youtube.com/vi/abc123/mqdefault.jpg");
  });

  it("ancienne URL /thumbnails/... d'une vidéo TikTok : chemin corrigé sous /api/thumbnails", () => {
    expect(
      resolveThumbnailUrl("/thumbnails/7300000/card.webp", {
        videoId: "7300000",
        platform: "tiktok",
      }),
    ).toBe("https://api.deepsightsynthesis.com/api/thumbnails/thumbnails/7300000/card.webp");
  });

  it("miniature absente : YouTube si possible, sinon rien", () => {
    expect(resolveThumbnailUrl(null, { videoId: "abc123" })).toBe(
      "https://img.youtube.com/vi/abc123/mqdefault.jpg",
    );
    expect(resolveThumbnailUrl("", { videoId: "x", platform: "tiktok" })).toBeUndefined();
    expect(resolveThumbnailUrl(undefined)).toBeUndefined();
  });

  it("youtubeThumbnailUrl ignore les autres plateformes", () => {
    expect(youtubeThumbnailUrl({ videoId: "abc", platform: "text" })).toBeUndefined();
  });
});
