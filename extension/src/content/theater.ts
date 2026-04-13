// ── Theater / fullscreen layout detection ──

export type LayoutMode = "default" | "theater" | "fullscreen";

export function detectLayoutMode(): LayoutMode {
  if (document.fullscreenElement) return "fullscreen";
  const flexy = document.querySelector("ytd-watch-flexy");
  if (flexy?.hasAttribute("theater")) return "theater";
  return "default";
}

let _observer: MutationObserver | null = null;
let _fsHandler: (() => void) | null = null;

export function watchLayoutMode(callback: (mode: LayoutMode) => void): void {
  stopWatchingLayout();

  const flexy = document.querySelector("ytd-watch-flexy");
  if (flexy) {
    _observer = new MutationObserver(() => callback(detectLayoutMode()));
    _observer.observe(flexy, {
      attributes: true,
      attributeFilter: ["theater"],
    });
  }

  _fsHandler = () => callback(detectLayoutMode());
  document.addEventListener("fullscreenchange", _fsHandler);
}

export function stopWatchingLayout(): void {
  _observer?.disconnect();
  _observer = null;
  if (_fsHandler) document.removeEventListener("fullscreenchange", _fsHandler);
  _fsHandler = null;
}
