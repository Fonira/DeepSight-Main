/**
 * 🧪 Test Utils — Wrapper pour render() avec tous les providers
 * Utilise les VRAIS providers pour que useLanguage/useAuth fonctionnent
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { vi } from 'vitest';
import { LanguageProvider } from '../contexts/LanguageContext';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 CUSTOM RENDER OPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  routerProps?: MemoryRouterProps;
}

/**
 * Custom render wrapper with all providers
 * Utilise le vrai LanguageProvider pour que useLanguage() fonctionne
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    routerProps = {},
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  // Create a fresh QueryClient for each test
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter {...routerProps}>
            <LanguageProvider>
              {children}
            </LanguageProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🪝 HOOK TESTING UTILS
// ═══════════════════════════════════════════════════════════════════════════════

import { renderHook as rtlRenderHook, RenderHookOptions } from '@testing-library/react';

export function renderHookWithProviders<TProps, TResult>(
  hook: (props: TProps) => TResult,
  options?: RenderHookOptions<TProps>
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <LanguageProvider>
              {children}
            </LanguageProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );
  }

  return {
    ...rtlRenderHook(hook, { wrapper: Wrapper, ...options }),
    queryClient,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🧮 FACTORY CREATORS FOR TESTS (re-export from api-mocks)
// ═══════════════════════════════════════════════════════════════════════════════

export { createMockUser } from './mocks/api-mocks';

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 RE-EXPORTS (Testing Library standards)
// ═══════════════════════════════════════════════════════════════════════════════

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
