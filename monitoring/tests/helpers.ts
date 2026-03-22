/**
 * Helpers partagés pour les smoke tests DeepSight
 */
import { Page } from '@playwright/test';

export const API_URL = process.env.API_URL || 'https://api.deepsightsynthesis.com';

export const ROUTES = {
  landing: '/',
  login: '/login',
  dashboard: '/dashboard',
  history: '/history',
  upgrade: '/upgrade',
  settings: '/settings',
  account: '/account',
  playlists: '/playlists',
  study: '/study',
  chat: '/chat',
  status: '/status',
  contact: '/contact',
  legalCGU: '/legal/cgu',
  legalCGV: '/legal/cgv',
  privacy: '/legal/privacy',
  apiDocs: '/api-docs',
  notFound: '/this-does-not-exist-404',
} as const;

export const API_ENDPOINTS = {
  health: '/health',
  login: '/api/auth/login',
  register: '/api/auth/register',
  me: '/api/auth/me',
  quota: '/api/auth/quota',
  analyze: '/api/videos/analyze',
  history: '/api/videos/history',
  plans: '/api/billing/plans',
  tournesol: '/api/tournesol/recommendations',
} as const;

/**
 * Crée un faux JWT avec une expiry lointaine.
 * Nécessaire car le frontend parse le JWT pour vérifier l'expiration.
 */
export function createFakeJwt(): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: '1',
      exp: Math.floor(Date.now() / 1000) + 86400, // +24h
      iat: Math.floor(Date.now() / 1000),
    })
  );
  const signature = btoa('fake-signature');
  return `${header}.${payload}.${signature}`;
}

/** Mock user pour simuler un état authentifié */
export const MOCK_USER = {
  id: 1,
  username: 'smoke-test',
  email: 'smoke@deepsightsynthesis.com',
  email_verified: true,
  plan: 'free' as const,
  credits: 250,
  credits_monthly: 250,
  is_admin: false,
  total_videos: 0,
  total_words: 0,
  total_playlists: 0,
  created_at: '2026-01-01T00:00:00Z',
};

/**
 * Ferme le CookieBanner s'il est visible (il bloque les clics sur mobile).
 * Appeler après page.goto() et waitForLoadState.
 */
export async function dismissCookieBanner(page: Page) {
  const acceptBtn = page.locator(
    'button:has-text("Tout accepter"), button:has-text("Accepter"), button:has-text("Accept"), button:has-text("Tout refuser")'
  ).first();

  if (await acceptBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await acceptBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
}

/**
 * Pre-dismiss le cookie banner via localStorage (avant page load).
 * Utiliser avec page.addInitScript().
 */
export function getAutoDismissCookieScript(): string {
  return `localStorage.setItem('cookie_consent', JSON.stringify({accepted: true, timestamp: Date.now()}));`;
}
