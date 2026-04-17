import {
  persistCrash,
  drainCrashes,
  __resetForTest,
} from "../../src/utils/crash-logger";

describe("boot instrumentation contract", () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
    __resetForTest();
  });

  test("if createWidgetShell throws, error is persisted with 'widget:create' context", async () => {
    const err = new Error("attachShadow blocked");
    await persistCrash(err, { step: "widget:create" });
    const drained = await drainCrashes();
    expect(drained).toHaveLength(1);
    expect(drained[0].message).toBe("attachShadow blocked");
    expect(drained[0].context).toEqual({ step: "widget:create" });
  });
});
