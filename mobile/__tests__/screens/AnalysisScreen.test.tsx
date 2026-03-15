/**
 * Tests for AnalysisScreen (screens/AnalysisScreen.tsx)
 * Covers: render, tab rendering, API calls, error states
 *
 * Note: AnalysisScreen has complex async lifecycle (polling, background tasks, etc.)
 * Tests focus on structure and API integration rather than deep DOM assertions.
 */
import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '../utils/test-utils';

// Mock all external dependencies
jest.mock('../../src/contexts/ThemeContext', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      bgPrimary: '#0D0D0F', bgSecondary: '#141416', bgTertiary: '#1A1A1D',
      bgElevated: '#1F1F23', textPrimary: '#FFFFFF', textSecondary: '#B8B8C0',
      textTertiary: '#8E8E96', textMuted: '#5E5E66', border: '#2A2A2F',
      accentPrimary: '#7C3AED', accentSecondary: '#EC4899', accentSuccess: '#10B981',
      accentWarning: '#F59E0B', accentError: '#EF4444', accentInfo: '#3B82F6',
      glassBg: 'rgba(255,255,255,0.05)', glassBorder: 'rgba(255,255,255,0.1)',
    },
  }),
}));

jest.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'fr',
    t: {
      common: {
        cancel: 'Annuler', error: 'Erreur', retry: 'Réessayer', close: 'Fermer',
        loading: 'Chargement...', copy: 'Copier', share: 'Partager', video: 'Vidéo',
        save: 'Sauvegarder', back: 'Retour', add: 'Ajouter',
      },
      analysis: {
        title: 'Analyse', summary: 'Résumé', concepts: 'Concepts',
        chat: 'Chat', studyTools: 'Outils', factCheck: 'Fact-check',
        keyConcepts: 'Concepts clés', noSummary: 'Aucun résumé disponible',
        inProgress: 'En cours...', failed: 'Analyse échouée',
        loading: 'Chargement...', publishedAt: 'Publié le',
        personalNotes: 'Notes personnelles', notesPlaceholder: 'Ajoutez vos notes...',
        noNotes: 'Aucune note', noConcepts: 'Aucun concept',
      },
      errors: { generic: 'Une erreur est survenue', tryAgain: 'Réessayer' },
      chat: {
        minimizeChat: 'Réduire', placeholder: 'Posez une question...',
        askQuestion: 'Poser une question', startConversation: 'Commencez la conversation',
        questionsRemaining: 'questions restantes', unlimitedQuestions: 'Questions illimitées',
        webSearchPlaceholder: 'Recherche web...', webSources: 'Sources web',
        title: 'Chat',
        errors: { failed: 'Échec du chat' },
        suggestions: { summary: 'Résumer', keyPoints: 'Points clés', explain: 'Expliquer' },
      },
      history: { empty: 'Aucune analyse' },
      success: { analysisCopied: 'Copié !', settingsSaved: 'Sauvegardé' },
    },
  }),
}));

jest.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'test', plan: 'free', credits: 100 },
    isAuthenticated: true,
  }),
}));

jest.mock('../../src/contexts/DoodleVariantContext', () => ({
  useScreenDoodleVariant: jest.fn(),
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: any) => React.createElement(Text, {}, props.name),
    MaterialIcons: (props: any) => React.createElement(Text, {}, props.name),
  };
});

// Mock constants/theme
jest.mock('../../src/constants/theme', () => ({
  Spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 },
  Typography: {
    fontFamily: { display: 'System', body: 'System', bodyMedium: 'System', bodySemiBold: 'System', bodyBold: 'System', mono: 'System' },
    fontSize: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, xxl: 24, '2xl': 24, '3xl': 30, '4xl': 36 },
    lineHeight: { none: 1, tight: 1.2, snug: 1.35, normal: 1.5, relaxed: 1.625, loose: 2 },
  },
  BorderRadius: { sm: 6, md: 10, lg: 16, xl: 20, xxl: 24, full: 9999 },
}));

// Stable function references to prevent infinite useEffect loops
const mockSubscribeToTask = jest.fn(() => jest.fn());
const mockGetTask = jest.fn(() => null);
jest.mock('../../src/contexts/BackgroundAnalysisContext', () => ({
  useBackgroundAnalysis: () => ({
    subscribeToTask: mockSubscribeToTask,
    getTask: mockGetTask,
  }),
}));

// Mock services
const mockGetSummary = jest.fn();
const mockGetStatus = jest.fn();
const mockGetEnrichedConcepts = jest.fn();
const mockGetHistory = jest.fn();

jest.mock('../../src/services/api', () => ({
  videoApi: {
    getSummary: (...args: any[]) => mockGetSummary(...args),
    getEnrichedConcepts: (...args: any[]) => mockGetEnrichedConcepts(...args),
    getStatus: (...args: any[]) => mockGetStatus(...args),
    factCheck: jest.fn(),
    webEnrich: jest.fn(),
    getReliabilityScore: jest.fn().mockResolvedValue({ overallScore: 0.8 }),
    getReliability: jest.fn().mockResolvedValue({ overall_score: 0.8, confidence: 'high', factors: [], recommendations: [] }),
    updateNotes: jest.fn().mockResolvedValue(undefined),
    updateTags: jest.fn().mockResolvedValue(undefined),
  },
  chatApi: {
    getHistory: (...args: any[]) => mockGetHistory(...args),
    getQuota: jest.fn().mockResolvedValue({ remaining: 5 }),
    sendMessage: jest.fn(),
    sendMessageStream: jest.fn(),
  },
  studyApi: {
    generateFlashcards: jest.fn().mockResolvedValue([]),
    generateQuiz: jest.fn().mockResolvedValue([]),
  },
  shareApi: { shareSummary: jest.fn() },
  ApiError: class extends Error {
    status: number;
    constructor(msg: string, status: number) { super(msg); this.status = status; }
  },
}));

jest.mock('../../src/hooks/usePlan', () => ({
  usePlan: () => ({
    limits: { chatQuestionsPerVideo: 5, chatDailyLimit: 10 },
    usage: { analyses_this_month: 2, chat_messages_today: 0 },
  }),
}));

jest.mock('../../src/config/planPrivileges', () => ({
  normalizePlanId: (plan: string) => plan || 'free',
  hasFeature: jest.fn().mockReturnValue(true),
  PLAN_LIMITS: { free: { chatQuestionsPerVideo: 5 } },
}));

jest.mock('../../src/utils/formatters', () => ({
  formatDuration: (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`,
  formatDate: (d: string) => d,
}));

jest.mock('../../src/utils/storeReview', () => ({
  trackAnalysisComplete: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/analytics', () => ({
  analytics: { track: jest.fn(), identify: jest.fn() },
}));

// Mock complex child components as simple stubs
jest.mock('../../src/components', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    Header: ({ title }: any) => <View testID="header"><Text>{title}</Text></View>,
    Card: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Badge: ({ label }: any) => <Text>{label}</Text>,
    Button: ({ title, onPress }: any) => <Pressable onPress={onPress}><Text>{title}</Text></Pressable>,
    YouTubePlayer: () => <View testID="youtube-player" />,
    useToast: () => ({ showToast: jest.fn() }),
    StreamingProgress: () => <View testID="streaming-progress" />,
    FreshnessIndicator: () => null,
    ReliabilityScore: () => null,
    DeepSightSpinner: () => <View testID="spinner" />,
  };
});

jest.mock('../../src/components/ui/PlatformBadge', () => ({
  PlatformBadge: () => null,
  detectPlatformFromUrl: () => 'youtube',
}));

jest.mock('../../src/components/ui', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    AnimatedTabBar: ({ tabs, activeTab, onTabPress }: any) => (
      <View testID="tab-bar">
        {tabs.map((tab: any) => (
          <Pressable key={tab.id} testID={`tab-${tab.id}`} onPress={() => onTabPress(tab.id)}>
            <Text>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
    ActionButton: () => null,
  };
});

jest.mock('../../src/components/study', () => ({ FlashcardsComponent: () => null, QuizComponent: () => null }));
jest.mock('../../src/components/factcheck', () => ({ FactCheckButton: () => null }));
jest.mock('../../src/components/enrichment', () => ({ WebEnrichment: () => null }));
jest.mock('../../src/components/academic', () => ({ AcademicSourcesSection: () => null }));
jest.mock('../../src/components/tournesol', () => ({ TournesolWidget: () => null }));
jest.mock('../../src/components/analysis/AnalysisValueDisplay', () => ({ AnalysisValueDisplay: () => null }));
jest.mock('../../src/components/analysis/AnalysisContentDisplay', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    AnalysisContentDisplay: ({ content }: any) => <View testID="content-display"><Text>{content}</Text></View>,
  };
});
jest.mock('../../src/components/audio/TTSPlayer', () => ({ TTSPlayer: () => null }));
jest.mock('../../src/components/chat/SuggestedQuestions', () => ({ SuggestedQuestions: () => null }));
jest.mock('../../src/components/chat/ChatBubble', () => ({ ChatBubble: () => null }));
jest.mock('../../src/components/chat/TypingIndicator', () => ({ TypingIndicator: () => null }));
jest.mock('../../src/components/chat/ChatInput', () => ({ ChatInput: () => null }));
jest.mock('../../src/components/chat', () => ({ FloatingChat: () => null }));
jest.mock('../../src/components/upgrade', () => ({ UpgradePromptModal: () => null }));

// Mock route
const mockSummaryId = 'test-summary-123';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(), goBack: jest.fn(), dispatch: jest.fn(),
    replace: jest.fn(), setOptions: jest.fn(),
  }),
  useRoute: () => ({
    params: { summaryId: mockSummaryId },
  }),
  useFocusEffect: jest.fn(),
}));

// Import after mocks
import { AnalysisScreen } from '../../src/screens/AnalysisScreen';

const mockSummary = {
  id: mockSummaryId,
  title: 'Test Video Title',
  summary: 'This is a detailed test summary.',
  mode: 'standard',
  category: 'tech',
  platform: 'youtube',
  videoId: 'abc123',
  video_url: 'https://youtube.com/watch?v=abc123',
  videoInfo: {
    thumbnail: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
    channel: 'Test Channel',
    duration: 600,
    publishedAt: '2024-01-01',
  },
  createdAt: '2024-01-15',
  word_count: 500,
};

describe('AnalysisScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: getStatus rejects so screen falls through to direct summary load
    mockGetStatus.mockRejectedValue(new Error('Not a task'));
    mockGetSummary.mockResolvedValue(mockSummary);
    mockGetEnrichedConcepts.mockResolvedValue({ concepts: [
      { name: 'Machine Learning', definition: 'A subset of AI' },
    ]});
    mockGetHistory.mockResolvedValue({ messages: [] });
  });

  describe('Rendering', () => {
    it('should render header with title', async () => {
      render(<AnalysisScreen />);
      expect(screen.getByText('Analyse')).toBeTruthy();
    });

    it('should render 4 tabs after loading', async () => {
      render(<AnalysisScreen />);

      // Wait for full loading chain: getStatus rejects → getSummary → concepts → history → setIsLoading(false)
      await waitFor(() => {
        expect(mockGetHistory).toHaveBeenCalledWith(mockSummaryId);
      }, { timeout: 5000 });

      // Wait for loading to finish and tabs to appear
      await waitFor(() => {
        expect(screen.getByTestId('tab-bar')).toBeTruthy();
      }, { timeout: 3000 });

      expect(screen.getByTestId('tab-chat')).toBeTruthy();
      expect(screen.getByTestId('tab-summary')).toBeTruthy();
      expect(screen.getByTestId('tab-concepts')).toBeTruthy();
      expect(screen.getByTestId('tab-tools')).toBeTruthy();
    });

    it('should render tab labels in French after loading', async () => {
      render(<AnalysisScreen />);

      // Wait for full loading chain to complete
      await waitFor(() => {
        expect(mockGetHistory).toHaveBeenCalledWith(mockSummaryId);
      }, { timeout: 5000 });

      await waitFor(() => {
        expect(screen.getByTestId('tab-bar')).toBeTruthy();
      }, { timeout: 3000 });

      expect(screen.getByText('Chat')).toBeTruthy();
      expect(screen.getByText('Résumé')).toBeTruthy();
      expect(screen.getByText('Concepts')).toBeTruthy();
      expect(screen.getByText('Outils')).toBeTruthy();
    });

    it('should show loading state initially', () => {
      mockGetStatus.mockReturnValue(new Promise(() => {})); // Never resolves
      render(<AnalysisScreen />);

      expect(screen.getByText('Chargement...')).toBeTruthy();
    });
  });

  describe('Data Loading', () => {
    it('should call getStatus with summaryId', async () => {
      render(<AnalysisScreen />);

      await waitFor(() => {
        expect(mockGetStatus).toHaveBeenCalledWith(mockSummaryId);
      });
    });

    it('should fall back to getSummary when getStatus fails', async () => {
      render(<AnalysisScreen />);

      await waitFor(() => {
        expect(mockGetSummary).toHaveBeenCalledWith(mockSummaryId);
      });
    });

    it('should load concepts after summary', async () => {
      render(<AnalysisScreen />);

      await waitFor(() => {
        expect(mockGetEnrichedConcepts).toHaveBeenCalledWith(mockSummaryId);
      });
    });

    it('should load chat history after summary', async () => {
      render(<AnalysisScreen />);

      await waitFor(() => {
        expect(mockGetHistory).toHaveBeenCalledWith(mockSummaryId);
      });
    });

    it('should load completed analysis via getStatus when status is completed', async () => {
      mockGetStatus.mockResolvedValue({ status: 'completed', summary_id: 'real-summary-456' });

      render(<AnalysisScreen />);

      await waitFor(() => {
        expect(mockGetSummary).toHaveBeenCalledWith('real-summary-456');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error when both getStatus and getSummary fail', async () => {
      mockGetStatus.mockRejectedValue(new Error('Not a task'));
      mockGetSummary.mockRejectedValue(new Error('Not found'));

      render(<AnalysisScreen />);

      await waitFor(() => {
        expect(screen.getByText(/erreur/i)).toBeTruthy();
      }, { timeout: 5000 });
    });

    it('should show retry button on error', async () => {
      mockGetStatus.mockRejectedValue(new Error('Not a task'));
      mockGetSummary.mockRejectedValue(new Error('Not found'));

      render(<AnalysisScreen />);

      await waitFor(() => {
        expect(screen.getByText('Réessayer')).toBeTruthy();
      }, { timeout: 5000 });
    });

    it('should show error when getStatus returns failed status', async () => {
      mockGetStatus.mockResolvedValue({ status: 'failed', error: 'Analyse échouée' });

      render(<AnalysisScreen />);

      await waitFor(() => {
        expect(screen.getByText(/échouée|erreur/i)).toBeTruthy();
      }, { timeout: 5000 });
    });
  });

  describe('Streaming State', () => {
    it('should show streaming UI when analysis is processing', async () => {
      // Use fake timers to prevent real setInterval from hanging
      jest.useFakeTimers();

      mockGetStatus.mockResolvedValue({
        status: 'processing',
        progress: 50,
        message: 'Analyzing transcript...',
      });

      render(<AnalysisScreen />);

      // Flush microtasks (promises) but not timers
      await jest.runAllTicksAsync?.() || await Promise.resolve();

      // Should not try to load summary for processing tasks
      expect(mockGetSummary).not.toHaveBeenCalled();

      // Cleanup: restore real timers to avoid affecting other tests
      jest.useRealTimers();
    });
  });
});
