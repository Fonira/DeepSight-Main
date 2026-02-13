/**
 * 🧪 CookieBanner Tests — RGPD compliance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CookieBanner, hasAnalyticsConsent, hasGivenConsent } from '../CookieBanner';

const STORAGE_KEY = 'deepsight_cookie_consent';

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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
    vi.advanceTimersByTime(1000);
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
  });

  it('should show banner on first visit after delay', async () => {
    render(<CookieBanner />);
    vi.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(screen.getByText(/cookies/i)).toBeInTheDocument();
    });
  });

  it('should hide banner after accepting all', async () => {
    render(<CookieBanner />);
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(screen.getByText(/Tout accepter/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Tout accepter/i));

    expect(screen.queryByText(/Tout accepter/i)).not.toBeInTheDocument();
  });

  it('should store analytics=true when accepting all', async () => {
    render(<CookieBanner />);
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      fireEvent.click(screen.getByText(/Tout accepter/i));
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(stored.analytics).toBe(true);
    expect(stored.essential).toBe(true);
    expect(stored.marketing).toBe(true);
  });

  it('should store analytics=false when refusing all', async () => {
    render(<CookieBanner />);
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      fireEvent.click(screen.getByText(/Tout refuser/i));
    });

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
