import { validateVideoURL, parseVideoURL } from "../../src/utils/validateVideoURL";

describe("validateVideoURL", () => {
  describe("accepts valid URLs", () => {
    test.each([
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/shorts/abc123XYZ_-",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.tiktok.com/@user/video/7123456789012345678",
      "https://vm.tiktok.com/ZMabc123/",
      "https://m.tiktok.com/v/7123456789012345678",
    ])("accepts %s", (url) => expect(validateVideoURL(url)).toBe(true));
  });

  describe("rejects invalid URLs", () => {
    test.each([
      "https://vimeo.com/123",
      "https://twitter.com/x/status/1",
      "https://www.facebook.com/watch?v=12345",
      "https://example.com",
      "not a url",
      "",
      "ftp://youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.tiktok.com/discover",
      "https://www.tiktok.com/explore",
      "https://www.tiktok.com/@user",
      "https://www.tiktok.com/foo/bar",
      "https://YouTube.com/watch?v=dQw4w9WgXcQ",
    ])("rejects %s", (url) => expect(validateVideoURL(url)).toBe(false));
  });
});

describe("parseVideoURL", () => {
  test("returns youtube + id for standard YouTube URL", () => {
    expect(parseVideoURL("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      platform: "youtube",
      videoId: "dQw4w9WgXcQ",
    });
  });
  test("returns youtube + id for shorts", () => {
    expect(parseVideoURL("https://youtube.com/shorts/abc123XYZ_-")).toEqual({
      platform: "youtube",
      videoId: "abc123XYZ_-",
    });
  });
  test("returns tiktok + id for @user/video/", () => {
    expect(parseVideoURL("https://www.tiktok.com/@u/video/7123456789012345678")).toEqual({
      platform: "tiktok",
      videoId: "7123456789012345678",
    });
  });
  test("returns tiktok + id for vm.tiktok short link", () => {
    expect(parseVideoURL("https://vm.tiktok.com/ZMabc123/")).toEqual({
      platform: "tiktok",
      videoId: "ZMabc123",
    });
  });
  test("returns null for invalid URL", () => {
    expect(parseVideoURL("https://vimeo.com/123")).toBeNull();
  });
});
