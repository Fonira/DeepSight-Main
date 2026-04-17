/**
 * Integration test: simulates a YouTube /watch page DOM, then exercises
 * the widget helpers (createWidgetShell + injectWidget) to assert the
 * host gets injected with a populated shadow root.
 */
import { setShadowRoot, getShadowRoot } from "../../src/content/shadow";
import {
  createWidgetShell,
  injectWidget,
  getExistingWidget,
} from "../../src/content/widget";

function setupYouTubeDom(): void {
  document.body.innerHTML = `
    <div id="content">
      <ytd-watch-flexy>
        <div id="primary"></div>
        <div id="secondary">
          <div id="secondary-inner"></div>
        </div>
      </ytd-watch-flexy>
    </div>
  `;
  const anchor = document.getElementById("secondary-inner")!;
  Object.defineProperty(anchor, "offsetHeight", {
    configurable: true,
    value: 800,
  });
  Object.defineProperty(anchor, "offsetWidth", {
    configurable: true,
    value: 400,
  });
}

describe("content script boot flow", () => {
  beforeEach(() => {
    setupYouTubeDom();
    setShadowRoot(null);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    setShadowRoot(null);
  });

  test("createWidgetShell returns a host with a live shadow", () => {
    const host = createWidgetShell("dark", false);
    expect(host).not.toBeNull();
    expect(host!.id).toBe("deepsight-host");
    expect(getShadowRoot()).not.toBeNull();
    expect(getExistingWidget()).not.toBeNull();
    expect(getExistingWidget()!.id).toBe("deepsight-card");
  });

  test("injectWidget inserts host into secondary-inner", () => {
    const host = createWidgetShell("dark", false);
    expect(host).not.toBeNull();
    const ok = injectWidget(host!, false);
    expect(ok).toBe(true);
    expect(
      document.querySelector("#secondary-inner #deepsight-host"),
    ).not.toBeNull();
  });

  test("injectWidget falls back to body floating when no anchor visible", () => {
    // Hide all sidebar anchors
    document
      .querySelectorAll(
        "#secondary-inner, #secondary, ytd-watch-next-secondary-results-renderer, #below, ytd-watch-metadata",
      )
      .forEach((el) => {
        if (el instanceof HTMLElement) {
          Object.defineProperty(el, "offsetHeight", {
            configurable: true,
            value: 0,
          });
          Object.defineProperty(el, "offsetWidth", {
            configurable: true,
            value: 0,
          });
        }
      });
    const host = createWidgetShell("dark", false);
    const ok = injectWidget(host!, false);
    expect(ok).toBe(true);
    expect(host!.parentElement).toBe(document.body);
    expect(host!.style.position).toBe("fixed");
  });

  test("second boot replaces zombie host (no duplicate)", () => {
    const host1 = createWidgetShell("dark", false);
    injectWidget(host1!, false);
    const host2 = createWidgetShell("light", false);
    injectWidget(host2!, false);
    expect(document.querySelectorAll("#deepsight-host")).toHaveLength(1);
    expect(document.querySelector("#deepsight-host")).toBe(host2);
  });
});
