import {
  createWidgetShell,
  injectWidget,
  removeWidget,
  isAnchorReady,
} from "../../src/content/widget";
import { setShadowRoot } from "../../src/content/shadow";

function makeVisible(el: HTMLElement, w = 300, h = 200): void {
  Object.defineProperty(el, "offsetHeight", { configurable: true, value: h });
  Object.defineProperty(el, "offsetWidth", { configurable: true, value: w });
}

function makeInvisible(el: HTMLElement): void {
  Object.defineProperty(el, "offsetHeight", { configurable: true, value: 0 });
  Object.defineProperty(el, "offsetWidth", { configurable: true, value: 0 });
}

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

describe("isAnchorReady", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("returns false when no anchor exists in the DOM", () => {
    expect(isAnchorReady()).toBe(false);
  });

  test("returns true when #secondary-inner exists and is visible", () => {
    document.body.innerHTML = '<div id="secondary-inner"></div>';
    makeVisible(document.getElementById("secondary-inner")!);
    expect(isAnchorReady()).toBe(true);
  });

  test("returns false when #secondary-inner exists but is invisible", () => {
    document.body.innerHTML = '<div id="secondary-inner"></div>';
    makeInvisible(document.getElementById("secondary-inner")!);
    expect(isAnchorReady()).toBe(false);
  });

  test("returns true when fallback anchor is visible (other anchors absent)", () => {
    document.body.innerHTML = '<ytd-watch-metadata></ytd-watch-metadata>';
    makeVisible(document.querySelector("ytd-watch-metadata") as HTMLElement);
    expect(isAnchorReady()).toBe(true);
  });

  test("returns false when all known anchors are invisible", () => {
    document.body.innerHTML = `
      <div id="secondary-inner"></div>
      <div id="secondary"></div>
      <div id="below"></div>
    `;
    makeInvisible(document.getElementById("secondary-inner")!);
    makeInvisible(document.getElementById("secondary")!);
    makeInvisible(document.getElementById("below")!);
    expect(isAnchorReady()).toBe(false);
  });
});
