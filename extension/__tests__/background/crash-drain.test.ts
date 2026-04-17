import { drainCrashes } from "../../src/utils/crash-logger";
import { reportCrashes } from "../../src/utils/sentry-reporter";

jest.mock("../../src/utils/sentry-reporter", () => ({
  reportCrashes: jest.fn().mockResolvedValue(undefined),
}));

describe("service worker crash drain contract", () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
    jest.clearAllMocks();
  });

  test("drainCrashes + reportCrashes integrate cleanly", async () => {
    await chrome.storage.local.set({
      ds_crash_log: [
        {
          message: "test",
          steps: ["a"],
          timestamp: 1,
          url: "https://youtube.com",
          userAgent: "test",
        },
      ],
    });
    const crashes = await drainCrashes();
    await reportCrashes(crashes);
    expect(reportCrashes).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ message: "test" })]),
    );
    const data = await chrome.storage.local.get("ds_crash_log");
    expect(data.ds_crash_log ?? []).toHaveLength(0);
  });
});
