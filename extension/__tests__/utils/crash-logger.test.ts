import {
  logBootStep,
  persistCrash,
  drainCrashes,
  getBootStepHistory,
  __resetForTest,
} from "../../src/utils/crash-logger";

describe("crash-logger", () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
    __resetForTest();
  });

  test("logBootStep appends to in-memory history and console", () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});
    logBootStep("bootstrap:start", { videoId: "abc" });
    const history = getBootStepHistory();
    expect(history).toHaveLength(1);
    expect(history[0].step).toBe("bootstrap:start");
    expect(history[0].detail).toEqual({ videoId: "abc" });
    expect(spy).toHaveBeenCalledWith("[DeepSight-boot]", "bootstrap:start", {
      videoId: "abc",
    });
    spy.mockRestore();
  });

  test("persistCrash stores error with steps history", async () => {
    logBootStep("step-a");
    logBootStep("step-b");
    await persistCrash(new Error("boom"), { context: "inject" });
    const data = await chrome.storage.local.get("ds_crash_log");
    const crashes = data.ds_crash_log as Array<{
      message: string;
      stack?: string;
      context?: unknown;
      steps: string[];
      timestamp: number;
      url: string;
      userAgent: string;
    }>;
    expect(crashes).toHaveLength(1);
    expect(crashes[0].message).toBe("boom");
    expect(crashes[0].steps).toEqual(["step-a", "step-b"]);
    expect(crashes[0].context).toEqual({ context: "inject" });
    expect(typeof crashes[0].timestamp).toBe("number");
  });

  test("persistCrash caps at 20 entries (FIFO)", async () => {
    for (let i = 0; i < 25; i++) {
      await persistCrash(new Error(`err-${i}`));
    }
    const data = await chrome.storage.local.get("ds_crash_log");
    const crashes = data.ds_crash_log as Array<{ message: string }>;
    expect(crashes).toHaveLength(20);
    expect(crashes[0].message).toBe("err-5");
    expect(crashes[19].message).toBe("err-24");
  });

  test("drainCrashes returns and clears", async () => {
    await persistCrash(new Error("one"));
    await persistCrash(new Error("two"));
    const drained = await drainCrashes();
    expect(drained).toHaveLength(2);
    const data = await chrome.storage.local.get("ds_crash_log");
    expect(data.ds_crash_log ?? []).toHaveLength(0);
  });
});
