/**
 * 🧪 CookieBanner Tests — RGPD compliance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CookieBanner, hasAnalyticsConsent, hasGivenConsent } from '../CookieBanner';

const STORAGE_KEY = 'deepsight_cookie_consent';

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not render if consent already given', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      essential: true,
      analytics: false,
      marketing: false,
      consentDate: new Date().toISOString(),
      version: 1,
    }));

    render(<CookieBanner />);
    expect(screen.queryByText(/nous respectons votre vie privée/i)).not.toBeInTheDocument();
  });

  it('should show banner on first visit after delay', async () => {
    render(<CookieBanner />);
    // Wait for the 800ms setTimeout to trigger and render the banner
    await waitFor(
      () => {
        expect(screen.getByText(/nous respectons votre vie privée/i)).toBeInTheDocument();
      },
      { timeout: 2000 } // Give it plenty of time for the 800ms timeout
    );
  });

  it('should hide banner after accepting all', async () => {
    render(<CookieBanner />);

    // Wait for banner to appear
    const acceptButton = await waitFor(
      () => screen.getByText('Tout accepter'),
      { timeout: 2000 }
    );

    // Click accept button
    fireEvent.click(acceptButton);

    // Verify banner is gone
    expect(screen.queryByText('Tout accepter')).not.toBeInTheDocument();
  });

  it('should store analytics=true when accepting all', async () => {
    render(<CookieBanner />);

    // Wait for banner and click accept
    const acceptButton = await waitFor(
      () => screen.getByText('Tout accepter'),
      { timeout: 2000 }
    );
    fireEvent.click(acceptButton);

    // Verify storage
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(stored.analytics).toBe(true);
    expect(stored.essential).toBe(true);
    expect(stored.marketing).toBe(true);
  });

  it('should store analytics=false when refusing all', async () => {
    render(<CookieBanner />);

    // Wait for banner and click refuse
    const refuseButton = await waitFor(
      () => screen.getByText('Tout refuser'),
      { timeout: 2000 }
    );
    fireEvent.click(refuseButton);

    // Verify storage
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(stored.analytics).toBe(false);
    expect(stored.marketing).toBe(false);
    expect(stored.essential).toBe(true); // Toujours true
  });
});

describe('hasAnalyticsConsent', () => {
  beforeEach(() => localStorage.clear());

  it('should return false when no consent stored', () => {
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('should return true when analytics accepted', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      essential: true, analytics: true, marketing: false,
      consentDate: new Date().toISOString(), version: 1,
    }));
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it('should return false when analytics refused', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      essential: true, analytics: false, marketing: false,
      consentDate: new Date().toISOString(), version: 1,
    }));
    expect(hasAnalyticsConsent()).toBe(false);
  });
});

describe('hasGivenConsent', () => {
  beforeEach(() => localStorage.clear());

  it('should return false when no consent', () => {
    expect(hasGivenConsent()).toBe(false);
  });

  it('should return true when any consent given', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      essential: true, analytics: false, marketing: false,
      consentDate: new Date().toISOString(), version: 1,
    }));
    expect(hasGivenConsent()).toBe(true);
  });
});
