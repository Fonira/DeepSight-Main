import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock contexts
const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@test.com',
  plan: 'free',
  credits: 100,
  credits_monthly: 150,
  total_videos: 5,
  total_words: 1000,
  total_playlists: 2,
  avatar_url: null,
  is_verified: true,
  default_mode: 'standard',
  default_model: 'gpt-4o-mini',
};

const mockAuthContext = {
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
  error: null,
  pendingVerificationEmail: null,
  login: jest.fn(),
  loginWithGoogle: jest.fn(),
  register: jest.fn(),
  verifyEmail: jest.fn(),
  logout: jest.fn(),
  forgotPassword: jest.fn(),
  refreshUser: jest.fn(),
  clearError: jest.fn(),
  clearPendingVerification: jest.fn(),
  resendVerificationCode: jest.fn(),
};

const mockThemeContext = {
  isDark: true,
  toggleTheme: jest.fn(),
  colors: {
    bgPrimary: '#0D0D0F',
    bgSecondary: '#141416',
    bgTertiary: '#1A1A1D',
    bgElevated: '#1F1F23',
    textPrimary: '#FFFFFF',
    textSecondary: '#B8B8C0',
    textTertiary: '#8E8E96',
    textMuted: '#5E5E66',
    border: '#2A2A2F',
    accentPrimary: '#7C3AED',
    accentSecondary: '#EC4899',
    accentSuccess: '#10B981',
    accentWarning: '#F59E0B',
    accentError: '#EF4444',
    accentInfo: '#3B82F6',
  },
};

const mockLanguageContext = {
  language: 'fr' as const,
  setLanguage: jest.fn(),
  t: {
    common: {
      cancel: 'Annuler',
      delete: 'Supprimer',
      error: 'Erreur',
      success: 'Succès',
      loading: 'Chargement...',
      retry: 'Réessayer',
      save: 'Sauvegarder',
      edit: 'Modifier',
      close: 'Fermer',
      all: 'Tous',
      noResults: 'Aucun résultat',
    },
    auth: {
      login: 'Connexion',
      register: 'Inscription',
      email: 'Email',
      password: 'Mot de passe',
      signOut: 'Déconnexion',
      signOutConfirm: 'Voulez-vous vraiment vous déconnecter ?',
      forgotPassword: 'Mot de passe oublié ?',
      noAccount: "Pas de compte ?",
      haveAccount: 'Déjà un compte ?',
      createAccount: 'Créer un compte',
      username: "Nom d'utilisateur",
      confirmPassword: 'Confirmer le mot de passe',
      continueWithGoogle: 'Continuer avec Google',
      or: 'ou',
    },
    nav: {
      dashboard: 'Accueil',
      history: 'Historique',
      profile: 'Profil',
      settings: 'Paramètres',
      analysis: 'Analyse',
    },
    dashboard: {
      analyze: 'Analyser',
      pasteUrl: 'Collez une URL YouTube...',
      selectMode: 'Mode',
      selectCategory: 'Catégorie',
    },
    history: {
      title: 'Historique',
      searchHistory: 'Rechercher...',
      confirmDeleteTitle: 'Supprimer',
      deleteConfirm: 'Voulez-vous supprimer',
      noAnalysesYet: 'Aucune analyse',
      emptyDesc: 'Commencez par analyser une vidéo',
      startFirstAnalysis: "Commencez votre première analyse",
      analyses: 'analyses',
      allCategories: 'Toutes les catégories',
    },
    chat: {
      title: 'Chat',
      askQuestion: 'Posez une question',
      placeholder: 'Tapez votre message...',
      startConversation: 'Commencez la conversation',
      questionsRemaining: 'questions restantes',
      unlimitedQuestions: 'Questions illimitées',
      suggestions: {
        keyPoints: 'Quels sont les points clés ?',
        summary: 'Résume cette vidéo',
        explain: 'Explique ce concept',
      },
    },
    settings: {
      account: 'Compte',
      subscription: 'Abonnement',
      usage: 'Utilisation',
      preferences: 'Préférences',
      appearance: 'Apparence',
      darkMode: 'Mode sombre',
      language: 'Langue',
      notifications: 'Notifications',
      support: 'Support',
      helpFaq: 'Aide & FAQ',
      contactUs: 'Nous contacter',
      termsOfService: 'Conditions d\'utilisation',
      defaultMode: 'Mode par défaut',
      defaultModel: 'Modèle par défaut',
      clearCache: 'Vider le cache',
      about: 'À propos',
      version: 'Version',
    },
    errors: {
      generic: 'Une erreur est survenue',
      network: 'Erreur réseau',
      tryAgain: 'Veuillez réessayer',
    },
    playlists: {
      title: 'Playlists',
      videos: 'vidéos',
    },
    admin: {
      user: 'Utilisateur',
      wordsGenerated: 'mots générés',
    },
  },
};

// Create mock context providers
export const MockAuthProvider: React.FC<{ children: ReactNode; value?: Partial<typeof mockAuthContext> }> = ({
  children,
  value = {},
}) => {
  const AuthContext = React.createContext({ ...mockAuthContext, ...value });
  return <AuthContext.Provider value={{ ...mockAuthContext, ...value }}>{children}</AuthContext.Provider>;
};

// Create query client for tests
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface WrapperProps {
  children: ReactNode;
  authValue?: Partial<typeof mockAuthContext>;
  themeValue?: Partial<typeof mockThemeContext>;
  languageValue?: Partial<typeof mockLanguageContext>;
}

// Create wrapper component for all providers
const createWrapper = (options?: Omit<WrapperProps, 'children'>) => {
  const queryClient = createTestQueryClient();

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <NavigationContainer>
            {children}
          </NavigationContainer>
        </SafeAreaProvider>
      </QueryClientProvider>
    );
  };
};

// Custom render function
const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'> & WrapperProps) => {
  const { authValue, themeValue, languageValue, ...renderOptions } = options || {};
  const Wrapper = createWrapper({ authValue, themeValue, languageValue });
  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Re-export everything
export * from '@testing-library/react-native';
export { customRender as render };

// Mock data factories
export const createMockUser = (overrides = {}) => ({
  ...mockUser,
  ...overrides,
});

export const createMockSummary = (overrides = {}) => ({
  id: '1',
  title: 'Test Video',
  thumbnail: 'https://example.com/thumb.jpg',
  channelName: 'Test Channel',
  duration: 600,
  publishedAt: '2024-01-01T00:00:00Z',
  createdAt: '2024-01-15T00:00:00Z',
  mode: 'standard',
  category: 'tech',
  summary: 'This is a test summary',
  isFavorite: false,
  ...overrides,
});

export const createMockChatMessage = (overrides = {}) => ({
  id: '1',
  role: 'user' as const,
  content: 'Test message',
  timestamp: new Date().toISOString(),
  ...overrides,
});

// API mock helpers
export const mockApiSuccess = (data: any) => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  });
};

export const mockApiError = (status: number, message: string) => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ detail: message }),
  });
};

export const mockNetworkError = () => {
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
};

// Wait utilities
export const waitForAsync = (ms: number = 0) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Export mock data
export { mockUser, mockAuthContext, mockThemeContext, mockLanguageContext };
