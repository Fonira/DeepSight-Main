/**
 * 🧪 Analytics Service Tests — PostHog RGPD compliance
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock posthog-js AVANT l'import du service
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    isFeatureEnabled: vi.fn(() => false),
    people: { set: vi.fn() },
  },
}));

// Mock CookieBanner helpers
vi.mock('../../components/CookieBanner', () => ({
  hasAnalyticsConsent: vi.fn(() => false),
  hasGivenConsent: vi.fn(() => false),
}));

import posthog from 'posthog-js';
import { hasAnalyticsConsent } from '../../components/CookieBanner';
const mockHasConsent = vi.mocked(hasAnalyticsConsent);

// Import APRÈS les mocks
import { analytics, AnalyticsEvents } from '../analytics';

describe('analytics service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RGPD compliance', () => {
    it('should NOT capture events without consent', () => {
      mockHasConsent.mockReturnValue(false);
      analytics.capture('test_event');
      expect(posthog.capture).not.toHaveBeenCalled();
    });

    it('should NOT identify users without consent', () => {
      mockHasConsent.mockReturnValue(false);
      analytics.identify('user-123', { plan: 'pro' });
      expect(posthog.identify).not.toHaveBeenCalled();
    });

    it('should NOT track pageviews without consent', () => {
      mockHasConsent.mockReturnValue(false);
      analytics.pageview('/dashboard');
      expect(posthog.capture).not.toHaveBeenCalled();
    });
  });

  describe('AnalyticsEvents', () => {
    it('should have all required event constants', () => {
      expect(AnalyticsEvents.SIGNUP).toBe('user_signup');
      expect(AnalyticsEvents.LOGIN).toBe('user_login');
      expect(AnalyticsEvents.VIDEO_ANALYZED).toBe('video_analyzed');
      expect(AnalyticsEvents.UPGRADE_STARTED).toBe('upgrade_started');
      expect(AnalyticsEvents.CHAT_MESSAGE_SENT).toBe('chat_message_sent');
      expect(AnalyticsEvents.EXPORT_CREATED).toBe('export_created');
      expect(AnalyticsEvents.ERROR_OCCURRED).toBe('error_occurred');
    });

    it('should have unique event names', () => {
      const values = Object.values(AnalyticsEvents);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });
});
