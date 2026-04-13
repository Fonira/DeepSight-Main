/**
 * Tests — YouTube & TikTok video ID extraction
 * Fichier source : src/utils/video.ts + src/utils/youtube.ts
 */

import {
  extractYouTubeVideoId,
  extractTikTokVideoId,
  extractVideoId,
  detectPlatform,
  isYouTubeUrl,
  isTikTokUrl,
  getYouTubeThumbnailUrl,
  getThumbnailUrl,
  getVideoUrl,
} from "../../src/utils/video";

import {
  extractVideoId as extractVideoIdLegacy,
  getThumbnailUrl as getThumbnailUrlLegacy,
} from "../../src/utils/youtube";

// ──────────────────────────────────
// YouTube — extractYouTubeVideoId
// ──────────────────────────────────
describe("extractYouTubeVideoId", () => {
  it("extracts ID from standard watch URL", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from URL with extra params", () => {
    expect(
      extractYouTubeVideoId(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120&list=PLx",
      ),
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from short URL (youtu.be)", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("extracts ID from short URL with timestamp", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=42")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("extracts ID from embed URL", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from shorts URL", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/shorts/abc123XYZ_-"),
    ).toBe("abc123XYZ_-");
  });

  it("returns null for non-YouTube URL", () => {
    expect(extractYouTubeVideoId("https://www.google.com")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractYouTubeVideoId("")).toBeNull();
  });

  it("returns null for YouTube homepage", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com")).toBeNull();
  });

  it("returns null for YouTube channel page", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/@MrBeast"),
    ).toBeNull();
  });
});

// ──────────────────────────────────
// TikTok — extractTikTokVideoId
// ──────────────────────────────────
describe("extractTikTokVideoId", () => {
  it("extracts ID from standard TikTok URL", () => {
    expect(
      extractTikTokVideoId(
        "https://www.tiktok.com/@user/video/7123456789012345678",
      ),
    ).toBe("7123456789012345678");
  });

  it("extracts ID from vm.tiktok short URL", () => {
    expect(extractTikTokVideoId("https://vm.tiktok.com/ZMrAbCdEf")).toBe(
      "ZMrAbCdEf",
    );
  });

  it("extracts ID from m.tiktok URL", () => {
    expect(
      extractTikTokVideoId("https://m.tiktok.com/v/7123456789012345678"),
    ).toBe("7123456789012345678");
  });

  it("extracts ID from tiktok.com/t/ URL", () => {
    expect(extractTikTokVideoId("https://www.tiktok.com/t/ZTR123abc")).toBe(
      "ZTR123abc",
    );
  });

  it("returns null for non-TikTok URL", () => {
    expect(
      extractTikTokVideoId("https://www.youtube.com/watch?v=test"),
    ).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractTikTokVideoId("")).toBeNull();
  });
});

// ──────────────────────────────────
// Multi-platform — extractVideoId
// ──────────────────────────────────
describe("extractVideoId (multi-platform)", () => {
  it("extracts YouTube ID", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=abc123")).toBe(
      "abc123",
    );
  });

  it("extracts TikTok ID", () => {
    expect(
      extractVideoId("https://www.tiktok.com/@user/video/7123456789012345678"),
    ).toBe("7123456789012345678");
  });

  it("returns null for unsupported platform", () => {
    expect(extractVideoId("https://www.vimeo.com/12345")).toBeNull();
  });
});

// ──────────────────────────────────
// Platform detection
// ──────────────────────────────────
describe("detectPlatform", () => {
  it("detects YouTube", () => {
    expect(detectPlatform("https://www.youtube.com/watch?v=abc")).toBe(
      "youtube",
    );
  });

  it("detects YouTube short URL", () => {
    expect(detectPlatform("https://youtu.be/abc")).toBe("youtube");
  });

  it("detects TikTok", () => {
    expect(detectPlatform("https://www.tiktok.com/@user/video/123")).toBe(
      "tiktok",
    );
  });

  it("returns null for unknown platform", () => {
    expect(detectPlatform("https://www.google.com")).toBeNull();
  });
});

describe("isYouTubeUrl", () => {
  it("returns true for YouTube watch URL", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
  });

  it("returns false for non-YouTube URL", () => {
    expect(isYouTubeUrl("https://www.google.com")).toBe(false);
  });
});

describe("isTikTokUrl", () => {
  it("returns true for TikTok URL", () => {
    expect(isTikTokUrl("https://www.tiktok.com/@user/video/123")).toBe(true);
  });

  it("returns false for non-TikTok URL", () => {
    expect(isTikTokUrl("https://www.youtube.com/watch?v=abc")).toBe(false);
  });
});

// ──────────────────────────────────
// Thumbnails & URLs
// ──────────────────────────────────
describe("getYouTubeThumbnailUrl", () => {
  it("returns correct thumbnail URL", () => {
    expect(getYouTubeThumbnailUrl("dQw4w9WgXcQ")).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg",
    );
  });
});

describe("getThumbnailUrl", () => {
  it("returns YouTube thumbnail for youtube platform", () => {
    expect(getThumbnailUrl("abc123", "youtube")).toBe(
      "https://img.youtube.com/vi/abc123/default.jpg",
    );
  });

  it("returns null for tiktok platform", () => {
    expect(getThumbnailUrl("123", "tiktok")).toBeNull();
  });

  it("defaults to YouTube thumbnail when no platform specified", () => {
    expect(getThumbnailUrl("abc123")).toBe(
      "https://img.youtube.com/vi/abc123/default.jpg",
    );
  });
});

describe("getVideoUrl", () => {
  it("returns YouTube URL by default", () => {
    expect(getVideoUrl("abc123")).toBe(
      "https://www.youtube.com/watch?v=abc123",
    );
  });

  it("returns TikTok URL for tiktok platform", () => {
    expect(getVideoUrl("123", "tiktok")).toBe(
      "https://www.tiktok.com/video/123",
    );
  });
});

// ──────────────────────────────────
// Legacy youtube.ts (backward compat)
// ──────────────────────────────────
describe("youtube.ts legacy — extractVideoId", () => {
  it("works the same as video.ts for YouTube URLs", () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    expect(extractVideoIdLegacy(url)).toBe("dQw4w9WgXcQ");
  });

  it("extracts from youtu.be", () => {
    expect(extractVideoIdLegacy("https://youtu.be/abc123")).toBe("abc123");
  });

  it("returns null for non-YouTube", () => {
    expect(extractVideoIdLegacy("https://www.google.com")).toBeNull();
  });
});

describe("youtube.ts legacy — getThumbnailUrl", () => {
  it("returns correct URL", () => {
    expect(getThumbnailUrlLegacy("dQw4w9WgXcQ")).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg",
    );
  });
});
