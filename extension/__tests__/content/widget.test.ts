import {
  createWidgetShell,
  injectWidget,
  removeWidget,
} from "../../src/content/widget";
import { setShadowRoot } from "../../src/content/shadow";

describe("widget zombie cleanup", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="secondary-inner"></div>';
    setShadowRoot(null);
  });

  afterEach(() => {
    removeWidget();
    document.body.innerHTML = "";
    setShadowRoot(null);
  });

  test("second createWidgetShell + injectWidget replaces the old host", () => {
    const first = createWidgetShell("dark", false);
    expect(first).not.toBeNull();
    const anchor = document.getElementById("secondary-inner")!;
    Object.defineProperty(anchor, "offsetHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(anchor, "offsetWidth", {
      configurable: true,
      value: 300,
    });
    const ok1 = injectWidget(first!, false);
    expect(ok1).toBe(true);
    expect(document.querySelectorAll("#deepsight-host")).toHaveLength(1);

    const second = createWidgetShell("light", false);
    expect(second).not.toBeNull();
    const ok2 = injectWidget(second!, false);
    expect(ok2).toBe(true);
    expect(document.querySelectorAll("#deepsight-host")).toHaveLength(1);
    const live = document.getElementById("deepsight-host");
    expect(live).toBe(second);
  });

  test("createWidgetShell returns null if attachShadow throws", () => {
    const originalAttach = HTMLDivElement.prototype.attachShadow;
    HTMLDivElement.prototype.attachShadow = (): ShadowRoot => {
      throw new Error("attachShadow blocked by another extension");
    };
    try {
      const host = createWidgetShell("dark", false);
      expect(host).toBeNull();
    } finally {
      HTMLDivElement.prototype.attachShadow = originalAttach;
    }
  });
});
