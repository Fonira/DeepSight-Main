import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import React from "react";
import { useCmdFIntercept } from "../useCmdFIntercept";

afterEach(cleanup);
afterEach(() => {
  // Clean up any DOM artefacts from previous tests
  document.body.innerHTML = "";
});

/**
 * Helper that fires a Cmd+F (or Ctrl+F) keydown event with the given target.
 * preventDefault tracking is exposed via the returned event for assertions.
 */
function fireCmdF(target: EventTarget | null) {
  const ev = new KeyboardEvent("keydown", {
    key: "f",
    metaKey: true,
    ctrlKey: false,
    bubbles: true,
    cancelable: true,
  });
  // Some platforms set ctrlKey instead of metaKey — both branches are
  // covered by the implementation, but for tests we use metaKey only.
  if (target) {
    Object.defineProperty(ev, "target", { value: target, writable: false });
    target.dispatchEvent(ev);
  } else {
    window.dispatchEvent(ev);
  }
  return ev;
}

describe("useCmdFIntercept", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("intercepts Cmd+F when the target is inside .analysis-page", () => {
    const onIntercept = vi.fn();
    const scope = document.createElement("div");
    scope.className = "analysis-page";
    const inner = document.createElement("div");
    scope.appendChild(inner);
    document.body.appendChild(scope);

    renderHook(() =>
      useCmdFIntercept({
        scopeSelector: ".analysis-page",
        onIntercept,
      }),
    );

    const ev = fireCmdF(inner);
    expect(onIntercept).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("does NOT intercept Cmd+F when the target is outside .analysis-page", () => {
    const onIntercept = vi.fn();
    const scope = document.createElement("div");
    scope.className = "analysis-page";
    document.body.appendChild(scope);
    const outside = document.createElement("div");
    document.body.appendChild(outside);

    renderHook(() =>
      useCmdFIntercept({
        scopeSelector: ".analysis-page",
        onIntercept,
      }),
    );

    const ev = fireCmdF(outside);
    expect(onIntercept).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it("does NOT intercept Cmd+F when the target is body (no analysis page on screen)", () => {
    const onIntercept = vi.fn();
    // No .analysis-page on the page at all.
    renderHook(() =>
      useCmdFIntercept({
        scopeSelector: ".analysis-page",
        onIntercept,
      }),
    );

    const ev = fireCmdF(document.body);
    expect(onIntercept).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it("does NOT intercept when enabled=false", () => {
    const onIntercept = vi.fn();
    const scope = document.createElement("div");
    scope.className = "analysis-page";
    document.body.appendChild(scope);

    renderHook(() =>
      useCmdFIntercept({
        scopeSelector: ".analysis-page",
        onIntercept,
        enabled: false,
      }),
    );

    fireCmdF(scope);
    expect(onIntercept).not.toHaveBeenCalled();
  });

  it("intercepts Cmd+F on a deeply nested child of .analysis-page", () => {
    const onIntercept = vi.fn();
    const scope = document.createElement("div");
    scope.className = "analysis-page";
    const a = document.createElement("section");
    const b = document.createElement("article");
    const c = document.createElement("p");
    a.appendChild(b);
    b.appendChild(c);
    scope.appendChild(a);
    document.body.appendChild(scope);

    renderHook(() =>
      useCmdFIntercept({
        scopeSelector: ".analysis-page",
        onIntercept,
      }),
    );

    fireCmdF(c);
    expect(onIntercept).toHaveBeenCalledTimes(1);
  });
});
