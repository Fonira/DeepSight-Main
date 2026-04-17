// ── Widget DOM management (Shadow DOM) ──

import Browser from "../utils/browser-polyfill";
import { getShadowRoot, setShadowRoot, $id, $qs } from "./shadow";

const WIDGET_ID = "deepsight-card";
const HOST_ID = "deepsight-host";
const BODY_CLASS = "ds-card-body";

const INJECTION_STRATEGIES = [
  { selector: "#secondary-inner", position: "prepend" as const },
  { selector: "#secondary", position: "prepend" as const },
  {
    selector: "ytd-watch-next-secondary-results-renderer",
    position: "prepend" as const,
  },
  { selector: "#below", position: "prepend" as const },
  { selector: "ytd-watch-metadata", position: "afterend" as const },
];

const TIKTOK_ANCHORS = [
  '[class*="DivBrowserModeContainer"]',
  '[class*="DivVideoDetailContainer"]',
  "#app",
  "body",
];

export function createWidgetShell(
  theme: "dark" | "light",
  isTikTok: boolean,
): HTMLDivElement {
  // Create the outer host element (lives in the page DOM)
  const host = document.createElement("div");
  host.id = HOST_ID;
  // Minimal host styles — just sizing, no visual styles that could be overridden
  host.style.cssText =
    "all:initial;display:block;width:100%;max-width:420px;margin-bottom:12px;";

  if (isTikTok) {
    host.style.cssText =
      "all:initial;position:fixed;bottom:20px;right:20px;width:360px;max-height:80vh;z-index:2147483646;";
  }

  // Attach closed shadow root for full encapsulation
  const shadow = host.attachShadow({ mode: "closed" });
  setShadowRoot(shadow);

  // ── YouTube/TikTok keyboard shortcut isolation ──
  // The host page (YouTube especially) registers keyboard shortcuts on
  // `document` (i = miniplayer, k = play/pause, m = mute, f = fullscreen,
  // t = theater, c = captions, j/l = seek, 0-9 = seek %). Events originating
  // inside our shadow root bubble out through the host and reach those
  // document-level listeners, hijacking the user's keystrokes while they
  // type credentials or chat messages.
  //
  // We stop propagation at the host. Shadow-internal React handlers still
  // run (they fire before the event crosses the shadow boundary), but
  // nothing escapes to the page.
  const stopKeyPropagation = (e: Event) => {
    e.stopPropagation();
  };
  host.addEventListener("keydown", stopKeyPropagation);
  host.addEventListener("keyup", stopKeyPropagation);
  host.addEventListener("keypress", stopKeyPropagation);

  // Inject styles into the shadow root (fully isolated from page)
  // tokens.css uses :host selector so variables work inside the shadow boundary
  const tokensLink = document.createElement("link");
  tokensLink.rel = "stylesheet";
  tokensLink.href = Browser.runtime.getURL("tokens.css");
  shadow.appendChild(tokensLink);

  const widgetStyleLink = document.createElement("link");
  widgetStyleLink.rel = "stylesheet";
  widgetStyleLink.href = Browser.runtime.getURL("widget.css");
  shadow.appendChild(widgetStyleLink);

  const contentStyleLink = document.createElement("link");
  contentStyleLink.rel = "stylesheet";
  contentStyleLink.href = Browser.runtime.getURL("content.css");
  shadow.appendChild(contentStyleLink);

  // Create the actual widget card inside shadow
  const el = document.createElement("div");
  el.id = WIDGET_ID;
  el.className = `ds-widget deepsight-card ${theme}`;
  if (isTikTok) {
    el.classList.add("deepsight-card-floating");
    el.style.cssText =
      "overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);border-radius:12px;";
  }
  shadow.appendChild(el);

  // Return host — callers insert this into the page DOM
  return host as HTMLDivElement;
}

export function buildWidgetHeader(logoHtml: string): string {
  return `
    <div class="ds-card-header">
      <div class="ds-card-logo">${logoHtml}<span>Deep Sight</span></div>
      <div style="display:flex;align-items:center;gap:4px">
        <span class="ds-card-badge">AI</span>
        <button class="ds-minimize-btn" id="ds-minimize-btn" type="button" title="Réduire">−</button>
      </div>
    </div>
  `;
}

function isSidebarVisible(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  return (
    el.offsetHeight > 0 &&
    el.offsetWidth > 50 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

let _floatingMode = false;

export function isWidgetDetached(): boolean {
  return !document.getElementById(HOST_ID);
}

export function isFloatingMode(): boolean {
  return _floatingMode;
}

export function injectWidget(host: HTMLDivElement, isTikTok: boolean): boolean {
  // Check if already injected
  if (document.getElementById(HOST_ID)) return true;

  _floatingMode = false;

  if (isTikTok) {
    for (const sel of TIKTOK_ANCHORS) {
      const anchor = document.querySelector(sel);
      if (anchor) {
        document.body.appendChild(host);
        return true;
      }
    }
    return false;
  }

  // Try each strategy in order, skipping invisible elements
  for (const { selector, position } of INJECTION_STRATEGIES) {
    const el = document.querySelector(selector);
    if (!(el instanceof HTMLElement) || !isSidebarVisible(el)) continue;

    if (position === "prepend") {
      el.insertBefore(host, el.firstChild);
    } else {
      // afterend — insert after the element
      el.parentElement?.insertBefore(host, el.nextSibling);
    }
    return true;
  }

  // Floating fallback — no sidebar found
  _floatingMode = true;
  host.style.cssText =
    "all:initial;position:fixed;bottom:20px;right:20px;width:380px;max-height:80vh;z-index:2147483646;";
  document.body.appendChild(host);
  return true;
}

export function removeWidget(): void {
  document.getElementById(HOST_ID)?.remove();
}

export function getExistingWidget(): HTMLDivElement | null {
  // The widget card is inside the shadow root
  return $id<HTMLDivElement>(WIDGET_ID);
}

export function setWidgetBody(html: string): void {
  const body = getWidgetBody();
  if (body) body.innerHTML = html;
}

export function getWidgetBody(): HTMLElement | null {
  return $qs(`#${WIDGET_ID} .${BODY_CLASS}`);
}

export function setWidgetInnerHTML(html: string): void {
  const widget = getExistingWidget();
  if (widget) widget.innerHTML = html;
}

function collapseWidget(): void {
  const widget = getExistingWidget();
  const btn = $id("ds-minimize-btn");
  if (!widget) return;
  widget.classList.add("ds-collapsed");
  if (btn) btn.textContent = "+";
}

function expandWidget(): void {
  const widget = getExistingWidget();
  const btn = $id("ds-minimize-btn");
  if (!widget) return;
  widget.classList.remove("ds-collapsed");
  if (btn) btn.textContent = "−";
}

export function bindMinimizeButton(): void {
  const btn = $id("ds-minimize-btn");
  const widget = getExistingWidget();
  if (!btn || !widget) return;

  // Restore persisted state
  Browser.storage.local.get(["ds_minimized"]).then((data) => {
    if (data.ds_minimized) collapseWidget();
  });

  btn.addEventListener("click", () => {
    const isCollapsed = widget.classList.contains("ds-collapsed");
    if (isCollapsed) {
      expandWidget();
      Browser.storage.local.set({ ds_minimized: false });
    } else {
      collapseWidget();
      Browser.storage.local.set({ ds_minimized: true });
    }
  });
}
