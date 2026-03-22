// ── État: login ──

import { WEBAPP_URL } from '../../utils/config';
import { setWidgetBody } from '../widget';
import { escapeHtml } from '../../utils/sanitize';

function spinnerSmall(): string {
  return `<svg class="ds-gouvernail-spinner ds-gouvernail-spinner-sm" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="14" height="14"><circle cx="24" cy="24" r="20" opacity="0.3"/><circle cx="24" cy="24" r="3"/><line x1="24" y1="4" x2="24" y2="11"/></svg>`;
}

export function renderLoginState(onLogin: () => void): void {
  const html = `
    <div class="ds-login-container">
      <p class="ds-subtitle">Analysez cette vidéo avec l'IA</p>

      <button class="ds-btn ds-btn-google" id="ds-google-login" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Connexion avec Google
      </button>

      <div class="ds-divider"><span>ou</span></div>

      <form id="ds-login-form" class="ds-login-form">
        <input type="email" id="ds-email" placeholder="Email" required autocomplete="email" />
        <input type="password" id="ds-password" placeholder="Mot de passe" required autocomplete="current-password" />
        <div id="ds-login-error" class="ds-error-msg hidden"></div>
        <button type="submit" class="ds-btn ds-btn-primary" id="ds-login-btn">Connexion</button>
      </form>

      <div class="ds-card-footer">
        <a href="${WEBAPP_URL}/register" target="_blank" rel="noreferrer">Créer un compte</a>
        <span>·</span>
        <a href="${WEBAPP_URL}" target="_blank" rel="noreferrer">deepsightsynthesis.com</a>
      </div>
    </div>
  `;

  setWidgetBody(html);

  document.getElementById('ds-google-login')?.addEventListener('click', async () => {
    const btn = document.getElementById('ds-google-login') as HTMLButtonElement | null;
    if (btn) { btn.disabled = true; btn.innerHTML = `${spinnerSmall()} Connexion...`; }
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'GOOGLE_LOGIN' });
      if (resp?.success && resp.user) {
        onLogin();
      } else {
        showError(resp?.error || 'Connexion Google échouée');
        if (btn) { btn.disabled = false; btn.textContent = 'Connexion avec Google'; }
      }
    } catch (e) {
      showError((e as Error).message);
      if (btn) { btn.disabled = false; btn.textContent = 'Connexion avec Google'; }
    }
  });

  document.getElementById('ds-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('ds-email') as HTMLInputElement).value;
    const password = (document.getElementById('ds-password') as HTMLInputElement).value;
    const btn = document.getElementById('ds-login-btn') as HTMLButtonElement | null;
    if (btn) { btn.disabled = true; btn.textContent = 'Connexion...'; }
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'LOGIN', data: { email, password } });
      if (resp?.success && resp.user) {
        onLogin();
      } else {
        showError(resp?.error || 'Connexion échouée');
        if (btn) { btn.disabled = false; btn.textContent = 'Connexion'; }
      }
    } catch (err) {
      showError(escapeHtml((err as Error).message));
      if (btn) { btn.disabled = false; btn.textContent = 'Connexion'; }
    }
  });
}

function showError(msg: string): void {
  const el = document.getElementById('ds-login-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}
