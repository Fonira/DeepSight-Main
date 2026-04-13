// ── Widget DOM observer ──
// Watches for SPA-driven DOM rewrites that detach the widget host.

const HOST_ID = "deepsight-host";

let _observer: MutationObserver | null = null;

export function startWidgetObserver(onDetached: () => void): void {
  stopWidgetObserver();

  const target =
    document.querySelector("ytd-watch-flexy") ||
    document.querySelector("#content");
  if (!target) return;

  _observer = new MutationObserver(() => {
    if (!document.getElementById(HOST_ID)) onDetached();
  });
  _observer.observe(target, { childList: true, subtree: false });
}

export function stopWidgetObserver(): void {
  _observer?.disconnect();
  _observer = null;
}
