// ── Widget DOM management (Shadow DOM) ──

import Browser from "../utils/browser-polyfill";
import { getShadowRoot, setShadowRoot, $id, $qs } from "./shadow";
import { getInlineStyles } from "./styles-inline";

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
): HTMLDivElement | null {
  let host: HTMLDivElement;
  try {
    host = document.createElement("div");
  } catch {
    return null;
  }
  host.id = HOST_ID;
  host.style.cssText =
    "all:initial;display:block;width:100%;max-width:420px;margin-bottom:12px;";

  if (isTikTok) {
    host.style.cssText =
      "all:initial;position:fixed;bottom:20px;right:20px;width:360px;max-height:80vh;z-index:2147483646;";
  }

  // Attach closed shadow root — wrapped in try/catch as another extension
  // (or policy-locked profile) may block attachShadow.
  let shadow: ShadowRoot;
  try {
    shadow = host.attachShadow({ mode: "closed" });
  } catch {
    return null;
  }
  setShadowRoot(shadow);

  const stopKeyPropagation = (e: Event) => {
    e.stopPropagation();
  };
  host.addEventListener("keydown", stopKeyPropagation);
  host.addEventListener("keyup", stopKeyPropagation);
  host.addEventListener("keypress", stopKeyPropagation);

  // Inject styles synchronously — see styles-inline.ts for rationale.
  const styleEl = document.createElement("style");
  styleEl.textContent = getInlineStyles();
  shadow.appendChild(styleEl);

  const el = document.createElement("div");
  el.id = WIDGET_ID;
  el.className = `ds-widget deepsight-card ${theme}`;
  if (isTikTok) {
    el.classList.add("deepsight-card-floating");
    el.style.cssText =
      "overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);border-radius:12px;";
  }
  shadow.appendChild(el);

  return host;
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
  // Zombie cleanup: if a previous host remains, remove it before inserting
  // the new one. Without this, the live shadow root (module singleton)
  // points to the NEW host's shadow while the OLD host stays in the DOM,
  // unstyled.
  const existing = document.getElementById(HOST_ID);
  if (existing && existing !== host) {
    existing.remove();
  }

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

  for (const { selector, position } of INJECTION_STRATEGIES) {
    const el = document.querySelector(selector);
    if (!(el instanceof HTMLElement) || !isSidebarVisible(el)) continue;

    if (position === "prepend") {
      el.insertBefore(host, el.firstChild);
    } else {
      el.parentElement?.insertBefore(host, el.nextSibling);
    }
    return true;
  }

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

const ANCHOR_SELECTORS = [
  "#secondary-inner",
  "#secondary",
  "ytd-watch-next-secondary-results-renderer",
  "#below",
  "ytd-watch-metadata",
];

/** True if at least one YouTube sidebar anchor is present AND visible. */
export function isAnchorReady(): boolean {
  for (const sel of ANCHOR_SELECTORS) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLElement && isSidebarVisible(el)) return true;
  }
  return false;
}
