/**
 * urlNormalizer (web) — unit tests.
 *
 * Mirrors backend/tests/voice/test_url_validator.py shape so behavior stays
 * lockstep across Python + TS.
 */

import { describe, expect, it } from "vitest";
import { normalizeUrl, normalizeVideoUrl } from "../urlNormalizer";

describe("normalizeUrl", () => {
  describe("YouTube native schemes", () => {
    it.each([
      [
        "vnd.youtube://watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      ],
      [
        "youtube://watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      ],
      [
        "vnd.youtube:dQw4w9WgXcQ",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      ],
    ])("rewrites %s", (raw, expected) => {
      expect(normalizeUrl(raw)).toBe(expected);
    });
  });

  describe("Android intent links", () => {
    it.each([
      [
        "intent://www.youtube.com/watch?v=dQw4w9WgXcQ#Intent;package=com.google.android.youtube;end",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      ],
      [
        "intent://m.youtube.com/watch?v=dQw4w9WgXcQ#Intent;scheme=https;package=com.google.android.youtube;end",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      ],
      [
        "intent://www.tiktok.com/@user/video/7123456789012345678#Intent;package=com.zhiliaoapp.musically;end",
        "https://www.tiktok.com/@user/video/7123456789012345678",
      ],
      [
        "intent://vm.tiktok.com/ZMabc123/#Intent;package=com.zhiliaoapp.musically;end",
        "https://vm.tiktok.com/ZMabc123/",
      ],
    ])("rewrites %s", (raw, expected) => {
      expect(normalizeUrl(raw)).toBe(expected);
    });
  });

  describe("TikTok native schemes", () => {
    it.each([
      [
        "snssdk1233://aweme/detail/7123456789012345678",
        "https://www.tiktok.com/@_/video/7123456789012345678",
      ],
      [
        "tiktok://aweme/detail/7123456789012345678",
        "https://www.tiktok.com/@_/video/7123456789012345678",
      ],
      [
        "tiktok://www.tiktok.com/@user/video/7123456789012345678",
        "https://www.tiktok.com/@_/video/7123456789012345678",
      ],
    ])("rewrites %s", (raw, expected) => {
      expect(normalizeUrl(raw)).toBe(expected);
    });
  });

  it("passes through canonical https URLs", () => {
    expect(normalizeUrl("https://www.youtube.com/watch?v=abc12345678")).toBe(
      "https://www.youtube.com/watch?v=abc12345678",
    );
  });

  it("strips whitespace", () => {
    expect(normalizeUrl("  https://youtu.be/abc  ")).toBe(
      "https://youtu.be/abc",
    );
  });

  it("returns empty for empty input", () => {
    expect(normalizeUrl("")).toBe("");
  });
});

describe("normalizeVideoUrl", () => {
  describe("recognizes canonical https URLs", () => {
    it.each([
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
      ["https://youtu.be/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
      ["https://youtube.com/shorts/abc123XYZ_-", "youtube", "abc123XYZ_-"],
      ["https://www.youtube.com/embed/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
      [
        "https://www.tiktok.com/@user/video/7123456789012345678",
        "tiktok",
        "7123456789012345678",
      ],
      ["https://vm.tiktok.com/ZMabc123/", "tiktok", "ZMabc123"],
      [
        "https://m.tiktok.com/v/7123456789012345678",
        "tiktok",
        "7123456789012345678",
      ],
    ])("%s → %s/%s", (url, platform, videoId) => {
      const result = normalizeVideoUrl(url);
      expect(result).not.toBeNull();
      expect(result!.platform).toBe(platform);
      expect(result!.videoId).toBe(videoId);
    });
  });

  describe("recognizes mobile/intent inputs end-to-end", () => {
    it.each([
      ["vnd.youtube://watch?v=dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
      ["youtube://watch?v=dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
      [
        "intent://www.youtube.com/watch?v=dQw4w9WgXcQ#Intent;package=com.google.android.youtube;end",
        "youtube",
        "dQw4w9WgXcQ",
      ],
      [
        "snssdk1233://aweme/detail/7123456789012345678",
        "tiktok",
        "7123456789012345678",
      ],
      [
        "tiktok://aweme/detail/7123456789012345678",
        "tiktok",
        "7123456789012345678",
      ],
      [
        "intent://www.tiktok.com/@user/video/7123456789012345678#Intent;package=com.zhiliaoapp.musically;end",
        "tiktok",
        "7123456789012345678",
      ],
      [
        "intent://vm.tiktok.com/ZMabc123/#Intent;package=com.zhiliaoapp.musically;end",
        "tiktok",
        "ZMabc123",
      ],
    ])("%s → %s/%s", (raw, platform, videoId) => {
      const result = normalizeVideoUrl(raw);
      expect(result).not.toBeNull();
      expect(result!.platform).toBe(platform);
      expect(result!.videoId).toBe(videoId);
    });
  });

  describe("rejects non-video URLs", () => {
    it.each([
      "https://vimeo.com/123456",
      "https://www.facebook.com/watch?v=12345",
      "https://example.com",
      "not a url",
      "",
      "https://www.tiktok.com/discover",
      "https://www.tiktok.com/@user", // profile sans /video/
    ])("%s → null", (raw) => {
      expect(normalizeVideoUrl(raw)).toBeNull();
    });
  });
});
