// ── Widget DOM management ──

const WIDGET_ID = 'deepsight-card';
const BODY_CLASS = 'ds-card-body';

const SIDEBAR_SELECTORS = [
  '#secondary-inner',
  '#secondary',
  'ytd-watch-next-secondary-results-renderer',
];

const TIKTOK_ANCHORS = [
  '[class*="DivBrowserModeContainer"]',
  '[class*="DivVideoDetailContainer"]',
  '#app',
  'body',
];

export function createWidgetShell(theme: 'dark' | 'light', isTikTok: boolean): HTMLDivElement {
  const el = document.createElement('div');
  el.id = WIDGET_ID;
  el.className = `deepsight-card ${theme}`;
  if (isTikTok) {
    el.classList.add('deepsight-card-floating');
    el.style.cssText = 'position:fixed;bottom:20px;right:20px;width:360px;max-height:80vh;overflow-y:auto;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,0.5);border-radius:12px;';
  }
  return el;
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

export function injectWidget(widget: HTMLDivElement, isTikTok: boolean): boolean {
  if (document.getElementById(WIDGET_ID)) return true;

  if (isTikTok) {
    for (const sel of TIKTOK_ANCHORS) {
      const anchor = document.querySelector(sel);
      if (anchor) {
        document.body.appendChild(widget);
        return true;
      }
    }
    return false;
  }

  for (const sel of SIDEBAR_SELECTORS) {
    const sidebar = document.querySelector(sel);
    if (sidebar instanceof HTMLElement) {
      if (sidebar.firstChild) {
        sidebar.insertBefore(widget, sidebar.firstChild);
      } else {
        sidebar.appendChild(widget);
      }
      return true;
    }
  }
  return false;
}

export function removeWidget(): void {
  document.getElementById(WIDGET_ID)?.remove();
}

export function getExistingWidget(): HTMLDivElement | null {
  return document.getElementById(WIDGET_ID) as HTMLDivElement | null;
}

export function setWidgetBody(html: string): void {
  const body = getWidgetBody();
  if (body) body.innerHTML = html;
}

export function getWidgetBody(): HTMLElement | null {
  return document.querySelector(`#${WIDGET_ID} .${BODY_CLASS}`);
}

export function bindMinimizeButton(): void {
  const btn = document.getElementById('ds-minimize-btn');
  const widget = getExistingWidget();
  if (!btn || !widget) return;
  btn.addEventListener('click', () => {
    const body = getWidgetBody();
    if (!body) return;
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? '' : 'none';
    btn.textContent = isHidden ? '−' : '+';
  });
}
