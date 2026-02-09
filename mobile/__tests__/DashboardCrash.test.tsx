/**
 * Smoke test to reproduce the DashboardScreen crash after login.
 * Uses react-test-renderer directly to capture the exact error.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Additional mocks beyond jest.setup.js
jest.mock('expo-font', () => ({
  loadAsync: jest.fn().mockResolvedValue(undefined),
  isLoaded: jest.fn().mockReturnValue(true),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  }),
  NetInfoStateType: { wifi: 'wifi', cellular: 'cellular', unknown: 'unknown' },
}));

jest.mock('../src/services/api', () => ({
  authApi: {
    getMe: jest.fn().mockResolvedValue({
      id: 1, username: 'testuser', email: 'test@test.com', plan: 'free',
      credits: 100, credits_monthly: 150, is_admin: false,
      total_videos: 5, total_words: 10000, total_playlists: 0,
      email_verified: true, created_at: '2024-01-01',
    }),
  },
  historyApi: {
    getHistory: jest.fn().mockResolvedValue({
      items: [], total: 0, page: 1, pageSize: 5, hasMore: false,
    }),
    getFavorites: jest.fn().mockResolvedValue([]),
  },
  videoApi: {
    analyze: jest.fn(),
    analyzeVideoV2: jest.fn(),
    discoverBest: jest.fn(),
  },
  usageApi: {
    getStats: jest.fn().mockResolvedValue({
      credits_used: 50, credits_remaining: 100, credits_total: 150,
      analyses_count: 2, chat_messages_count: 0, exports_count: 0,
      reset_date: '2024-02-01',
    }),
  },
  ApiError: class ApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

jest.mock('../src/utils/storage', () => ({
  storage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    setObject: jest.fn().mockResolvedValue(undefined),
    getObject: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
  tokenStorage: {
    getAccessToken: jest.fn().mockResolvedValue('mock-token'),
    getRefreshToken: jest.fn().mockResolvedValue('mock-refresh'),
    setTokens: jest.fn().mockResolvedValue(undefined),
    clearTokens: jest.fn().mockResolvedValue(undefined),
    hasTokens: jest.fn().mockResolvedValue(true),
  },
  userStorage: {
    setUser: jest.fn().mockResolvedValue(undefined),
    getUser: jest.fn().mockResolvedValue(null),
    clearUser: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../src/services/CrashReporting', () => ({
  initCrashReporting: jest.fn().mockResolvedValue(undefined),
  captureException: jest.fn(),
  setUser: jest.fn(),
}));

jest.mock('../src/services/TokenManager', () => ({
  tokenManager: {
    initialize: jest.fn().mockResolvedValue(undefined),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  },
}));

// Import after mocks
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { LanguageProvider } from '../src/contexts/LanguageContext';
import { AuthProvider } from '../src/contexts/AuthContext';
import { PlanProvider } from '../src/contexts/PlanContext';
import { BackgroundAnalysisProvider } from '../src/contexts/BackgroundAnalysisContext';
import { OfflineProvider } from '../src/contexts/OfflineContext';
import { ErrorProvider } from '../src/contexts/ErrorContext';
import { DashboardScreen } from '../src/screens/DashboardScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const AllProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <ErrorProvider>
      <OfflineProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <PlanProvider>
                <BackgroundAnalysisProvider>
                  <NavigationContainer>
                    {children}
                  </NavigationContainer>
                </BackgroundAnalysisProvider>
              </PlanProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </OfflineProvider>
    </ErrorProvider>
  </QueryClientProvider>
);

describe('DashboardScreen crash reproduction', () => {
  beforeEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('should render without crashing (authenticated user)', async () => {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    let renderError: Error | null = null;

    try {
      await act(async () => {
        renderer = TestRenderer.create(
          <AllProviders>
            <DashboardScreen />
          </AllProviders>
        );
      });

      // Wait for async effects
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      });
    } catch (error) {
      renderError = error as Error;
      console.error('=== DASHBOARD CRASH ERROR ===');
      console.error('Message:', (error as Error).message);
      console.error('Stack:', (error as Error).stack);
      console.error('=== END CRASH ERROR ===');
    }

    if (renderError) {
      // Re-throw so the test fails with the actual error message
      throw renderError;
    }

    expect(renderer).not.toBeNull();
  });
});
