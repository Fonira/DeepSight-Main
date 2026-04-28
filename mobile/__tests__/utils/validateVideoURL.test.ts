import {
  validateVideoURL,
  parseVideoURL,
} from "../../src/utils/validateVideoURL";

describe("validateVideoURL", () => {
  test.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/shorts/abc123XYZ_-",
    "https://www.tiktok.com/@user/video/7123456789012345678",
    "https://vm.tiktok.com/ZMabc123/",
  ])("accepts %s", (url) => expect(validateVideoURL(url)).toBe(true));

  test.each([
    "https://vimeo.com/123",
    "https://twitter.com/x/status/1",
    "not a url",
    "",
    "ftp://youtube.com/watch?v=dQw4w9WgXcQ",
  ])("rejects %s", (url) => expect(validateVideoURL(url)).toBe(false));
});

describe("parseVideoURL", () => {
  test("returns youtube + id", () => {
    expect(parseVideoURL("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      platform: "youtube",
      videoId: "dQw4w9WgXcQ",
    });
  });
  test("returns tiktok + id", () => {
    expect(
      parseVideoURL("https://www.tiktok.com/@u/video/7123456789012345678"),
    ).toEqual({
      platform: "tiktok",
      videoId: "7123456789012345678",
    });
  });
  test("returns null for invalid", () => {
    expect(parseVideoURL("https://vimeo.com/123")).toBeNull();
  });
});
