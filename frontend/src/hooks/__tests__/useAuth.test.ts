/**
 * Tests unitaires — useAuth hook
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the API module
vi.mock('../../services/api', () => {
  const mockClearTokens = vi.fn();
  const mockSetTokens = vi.fn();
  const mockGetAccessToken = vi.fn(() => null);
  const mockGetRefreshToken = vi.fn(() => null);

  return {
    authApi: {
      login: vi.fn(),
      loginWithGoogle: vi.fn(),
      register: vi.fn(),
      verifyEmail: vi.fn(),
      logout: vi.fn(),
      me: vi.fn(),
      refresh: vi.fn(),
    },
    clearTokens: mockClearTokens,
    setTokens: mockSetTokens,
    getAccessToken: mockGetAccessToken,
    getRefreshToken: mockGetRefreshToken,
    ApiError: class ApiError extends Error {
      status: number;
      data?: Record<string, unknown>;
      constructor(message: string, status: number, data?: Record<string, unknown>) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
      }
      get isRateLimited() { return this.status === 429; }
      get isUnauthorized() { return this.status === 401; }
      get isNotFound() { return this.status === 404; }
      get isForbidden() { return this.status === 403; }
    },
    User: {},
  };
});

import { useAuth } from '../useAuth';
import { authApi, clearTokens, setTokens, getAccessToken, getRefreshToken, ApiError } from '../../services/api';

const mockAuthApi = vi.mocked(authApi);
const mockGetAccessToken = vi.mocked(getAccessToken);
const mockGetRefreshToken = vi.mocked(getRefreshToken);
const mockSetTokens = vi.mocked(setTokens);
const mockClearTokens = vi.mocked(clearTokens);

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.clearAllMocks();

  // Default: no token
  mockGetAccessToken.mockReturnValue(null);
  mockGetRefreshToken.mockReturnValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════

describe('Initial State', () => {
  it('starts unauthenticated when no token', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('provides loading alias', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(result.current.isLoading);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════

describe('Login', () => {
  it('login success → user loaded via refreshUser', async () => {
    const mockUser = { id: 1, email: 'test@test.com', plan: 'free' };

    mockAuthApi.login.mockResolvedValueOnce({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
    });

    // After login, refreshUser(true) is called, which calls getAccessToken
    mockGetAccessToken.mockReturnValue('new-access');
    mockAuthApi.me.mockResolvedValueOnce(mockUser as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('test@test.com', 'password');
    });

    expect(mockAuthApi.login).toHaveBeenCalledWith('test@test.com', 'password');
  });

  it('login failure → error state set', async () => {
    const apiError = new (ApiError as any)('Invalid credentials', 401);
    mockAuthApi.login.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.login('test@test.com', 'wrong');
      } catch {
        // Expected
      }
    });

    expect(result.current.error).toBe('Invalid credentials');
    expect(result.current.isLoading).toBe(false);
  });

  it('login sets isLoading while in progress', async () => {
    let resolveLogin: (value: any) => void;
    const loginPromise = new Promise(resolve => { resolveLogin = resolve; });
    mockAuthApi.login.mockReturnValueOnce(loginPromise as any);

    const { result } = renderHook(() => useAuth());

    // Start login but don't await
    act(() => {
      result.current.login('test@test.com', 'password').catch(() => {});
    });

    // Should be loading
    expect(result.current.isLoading).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════

describe('Logout', () => {
  it('logout → clears tokens and user', async () => {
    mockAuthApi.logout.mockResolvedValueOnce({});

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(mockClearTokens).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('logout dispatches auth:logout event', async () => {
    const handler = vi.fn();
    window.addEventListener('auth:logout', handler);

    mockAuthApi.logout.mockResolvedValueOnce({});

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(handler).toHaveBeenCalled();
    window.removeEventListener('auth:logout', handler);
  });

  it('logout works even if API call fails', async () => {
    mockAuthApi.logout.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    // Should still clear local state
    expect(mockClearTokens).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════════════════════════════════

describe('Register', () => {
  it('register success → loading cleared', async () => {
    mockAuthApi.register.mockResolvedValueOnce({ success: true, message: 'ok' });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.register('user', 'test@test.com', 'password');
    });

    expect(mockAuthApi.register).toHaveBeenCalledWith('user', 'test@test.com', 'password');
    expect(result.current.isLoading).toBe(false);
  });

  it('register failure → error state', async () => {
    const apiError = new (ApiError as any)('Email already exists', 409);
    mockAuthApi.register.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.register('user', 'taken@test.com', 'password');
      } catch {
        // Expected
      }
    });

    expect(result.current.error).toBe('Email already exists');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// VERIFY EMAIL
// ═══════════════════════════════════════════════════════════════════════

describe('Verify Email', () => {
  it('verifyEmail calls API correctly', async () => {
    mockAuthApi.verifyEmail.mockResolvedValueOnce({});

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.verifyEmail('test@test.com', '123456');
    });

    expect(mockAuthApi.verifyEmail).toHaveBeenCalledWith('test@test.com', '123456');
  });

  it('verifyEmail failure → error message', async () => {
    const apiError = new (ApiError as any)('Code invalide', 400);
    mockAuthApi.verifyEmail.mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.verifyEmail('test@test.com', 'wrong');
      } catch {
        // Expected
      }
    });

    expect(result.current.error).toBe('Code invalide');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// RETURN SHAPE
// ═══════════════════════════════════════════════════════════════════════

describe('Return Shape', () => {
  it('returns all expected methods and state', () => {
    const { result } = renderHook(() => useAuth());

    // State
    expect(result.current).toHaveProperty('user');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('isAuthenticated');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('loading');

    // Methods
    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.loginWithGoogle).toBe('function');
    expect(typeof result.current.register).toBe('function');
    expect(typeof result.current.verifyEmail).toBe('function');
    expect(typeof result.current.logout).toBe('function');
    expect(typeof result.current.refreshUser).toBe('function');
  });
});
