// ── Theme detection ──

export function detectTheme(): 'dark' | 'light' {
  const html = document.documentElement;
  const isDark =
    html.getAttribute('dark') === 'true' ||
    html.hasAttribute('dark') ||
    document.body.classList.contains('dark') ||
    getComputedStyle(document.body).backgroundColor.includes('rgb(15,') ||
    getComputedStyle(html).getPropertyValue('--yt-spec-base-background').includes('#0f');
  return isDark ? 'dark' : 'light';
}

type ThemeCallback = (theme: 'dark' | 'light') => void;

export function watchTheme(callback: ThemeCallback): void {
  const observer = new MutationObserver(() => {
    callback(detectTheme());
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['dark', 'class'],
  });
}
