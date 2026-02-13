/**
 * 🧪 PrivateRoute Tests — Protection des routes authentifiées
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivateRoute } from '../PrivateRoute';

// Mock useAuth
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../hooks/useAuth';
const mockUseAuth = vi.mocked(useAuth);

function renderWithRouter(ui: React.ReactElement, initialRoute = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      {ui}
    </MemoryRouter>
  );
}

describe('PrivateRoute', () => {
  it('should show loading spinner when auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true } as ReturnType<typeof useAuth>);

    renderWithRouter(
      <PrivateRoute>
        <div>Protected Content</div>
      </PrivateRoute>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should render children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, email: 'test@test.com' },
      loading: false,
    } as ReturnType<typeof useAuth>);

    renderWithRouter(
      <PrivateRoute>
        <div>Protected Content</div>
      </PrivateRoute>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect to /login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>);

    renderWithRouter(
      <PrivateRoute>
        <div>Protected Content</div>
      </PrivateRoute>
    );

    // Content should NOT be rendered
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    // Navigate component redirects (we can't directly test the redirect target in JSDOM,
    // but we verify the protected content is not shown)
  });

  it('should NOT have any DEV bypass', () => {
    // Regression test: ensure no import.meta.env.DEV bypass exists
    mockUseAuth.mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>);

    renderWithRouter(
      <PrivateRoute>
        <div>Should Not Render</div>
      </PrivateRoute>
    );

    // Even in test/dev environment, unauthenticated users should NOT see content
    expect(screen.queryByText('Should Not Render')).not.toBeInTheDocument();
  });
});
