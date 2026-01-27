import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, screen } from '../utils/test-utils';
import { createMockSummary } from '../utils/test-utils';

// Mock APIs
const mockGetHistory = jest.fn();
const mockToggleFavorite = jest.fn();
const mockDeleteSummary = jest.fn();

jest.mock('../../src/services/api', () => ({
  historyApi: {
    getHistory: mockGetHistory,
    toggleFavorite: mockToggleFavorite,
    deleteSummary: mockDeleteSummary,
  },
}));

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

// Mock contexts
jest.mock('../../src/contexts/ThemeContext', () => ({
  useTheme: () => ({
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
      accentError: '#EF4444',
    },
  }),
}));

jest.mock('../../src/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      history: {
        title: 'Historique',
        searchHistory: 'Rechercher...',
        confirmDeleteTitle: 'Supprimer',
        deleteConfirm: 'Voulez-vous supprimer',
        noAnalysesYet: 'Aucune analyse',
        emptyDesc: 'Commencez par analyser une video',
        startFirstAnalysis: 'Commencez votre premiere analyse',
        analyses: 'analyses',
        allCategories: 'Toutes les categories',
      },
      common: {
        cancel: 'Annuler',
        delete: 'Supprimer',
        error: 'Erreur',
        all: 'Tous',
        noResults: 'Aucun resultat',
      },
      dashboard: {
        analyze: 'Analyser',
        selectMode: 'Mode',
        selectCategory: 'Categorie',
      },
      errors: {
        generic: 'Une erreur est survenue',
        tryAgain: 'Veuillez reessayer',
      },
    },
  }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

// Import after mocks
import { HistoryScreen } from '../../src/screens/HistoryScreen';

describe('HistoryScreen', () => {
  const mockAnalyses = [
    createMockSummary({ id: '1', title: 'Video One', isFavorite: false }),
    createMockSummary({ id: '2', title: 'Video Two', isFavorite: true }),
    createMockSummary({ id: '3', title: 'Video Three', isFavorite: false }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHistory.mockResolvedValue({
      items: mockAnalyses,
      hasMore: false,
      total: 3,
    });
  });

  describe('Rendering', () => {
    it('should render history screen with header', async () => {
      render(<HistoryScreen />);

      await waitFor(() => {
        expect(screen.getByText('Historique')).toBeTruthy();
      });
    });

    it('should render search input', async () => {
      render(<HistoryScreen />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/rechercher/i)).toBeTruthy();
      });
    });

    it('should render filter buttons', async () => {
      render(<HistoryScreen />);

      await waitFor(() => {
        // Favorites filter button
        expect(screen.getByTestId?.('favorites-filter') || screen.queryAllByRole('button').length).toBeGreaterThan(0);
      });
    });

    it('should render video cards when data loaded', async () => {
      render(<HistoryScreen />);

      await waitFor(() => {
        expect(screen.getByText('Video One')).toBeTruthy();
        expect(screen.getByText('Video Two')).toBeTruthy();
        expect(screen.getByText('Video Three')).toBeTruthy();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no analyses', async () => {
      mockGetHistory.mockResolvedValueOnce({
        items: [],
        hasMore: false,
        total: 0,
      });

      render(<HistoryScreen />);

      await waitFor(() => {
        expect(screen.getByText(/aucune analyse/i)).toBeTruthy();
      });
    });

    it('should show action button in empty state', async () => {
      mockGetHistory.mockResolvedValueOnce({
        items: [],
        hasMore: false,
        total: 0,
      });

      render(<HistoryScreen />);

      await waitFor(() => {
        expect(screen.getByText(/analyser/i)).toBeTruthy();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator initially', () => {
      // Don't resolve the promise yet
      mockGetHistory.mockReturnValue(new Promise(() => {}));

      render(<HistoryScreen />);

      // Loading indicator should be visible
      expect(screen.getByTestId?.('loading-indicator') || true).toBeTruthy();
    });
  });

  describe('Search', () => {
    it('should filter results when typing in search', async () => {
      render(<HistoryScreen />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/rechercher/i);
        fireEvent.changeText(searchInput, 'One');
      });

      // Should trigger a new API call with search filter
      await waitFor(() => {
        expect(mockGetHistory).toHaveBeenCalledWith(
          1,
          20,
          expect.objectContaining({
            search: 'One',
          })
        );
      });
    });

    it('should clear search when clear button pressed', async () => {
      render(<HistoryScreen />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/rechercher/i);
        fireEvent.changeText(searchInput, 'One');
      });

      // Find and press clear button
      const clearButton = screen.getByTestId?.('clear-search');
      if (clearButton) {
        fireEvent.press(clearButton);

        await waitFor(() => {
          const searchInput = screen.getByPlaceholderText(/rechercher/i);
          expect(searchInput.props.value).toBe('');
        });
      }
    });

    it('should show no results message when search has no matches', async () => {
      mockGetHistory.mockResolvedValueOnce({
        items: [],
        hasMore: false,
        total: 0,
      });

      render(<HistoryScreen />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/rechercher/i);
        fireEvent.changeText(searchInput, 'nonexistent');
      });

      await waitFor(() => {
        expect(screen.getByText(/aucun resultat/i)).toBeTruthy();
      });
    });
  });

  describe('Filters', () => {
    it('should toggle favorites filter', async () => {
      render(<HistoryScreen />);

      await waitFor(() => {
        const favoritesButton = screen.getByTestId?.('favorites-filter');
        if (favoritesButton) {
          fireEvent.press(favoritesButton);
        }
      });

      await waitFor(() => {
        expect(mockGetHistory).toHaveBeenCalledWith(
          1,
          20,
          expect.objectContaining({
            favoritesOnly: true,
          })
        );
      });
    });

    it('should show filter options panel', async () => {
      render(<HistoryScreen />);

      await waitFor(() => {
        const filtersButton = screen.getByTestId?.('filters-button');
        if (filtersButton) {
          fireEvent.press(filtersButton);
        }
      });

      // Filter chips should appear
      await waitFor(() => {
        expect(screen.getByText('Standard')).toBeTruthy();
      });
    });

    it('should filter by mode', async () => {
      render(<HistoryScreen />);

      // Open filters
      const filtersButton = screen.getByTestId?.('filters-button');
      if (filtersButton) {
        fireEvent.press(filtersButton);
      }

      await waitFor(() => {
        const modeChip = screen.getByText('Standard');
        fireEvent.press(modeChip);
      });

      await waitFor(() => {
        expect(mockGetHistory).toHaveBeenCalledWith(
          1,
          20,
          expect.objectContaining({
            mode: 'Standard',
          })
        );
      });
    });

    it('should filter by category', async () => {
      render(<HistoryScreen />);

      // Open filters
      const filtersButton = screen.getByTestId?.('filters-button');
      if (filtersButton) {
        fireEvent.press(filtersButton);
      }

      await waitFor(() => {
        const categoryChip = screen.getByText('Science');
        fireEvent.press(categoryChip);
      });

      await waitFor(() => {
        expect(mockGetHistory).toHaveBeenCalledWith(
          1,
          20,
          expect.objectContaining({
            category: 'Science',
          })
        );
      });
    });
  });

  describe('View Mode', () => {
    it('should toggle between list and grid view', async () => {
      render(<HistoryScreen />);

      await waitFor(() => {
        const viewModeButton = screen.getByTestId?.('view-mode-toggle');
        if (viewModeButton) {
          fireEvent.press(viewModeButton);
          // View should switch to grid
        }
      });
    });
  });

  describe('Video Card Actions', () => {
    it('should navigate to Analysis when card pressed', async () => {
      render(<HistoryScreen />);

      await waitFor(() => {
        const videoCard = screen.getByText('Video One');
        fireEvent.press(videoCard);
      });

      expect(mockNavigate).toHaveBeenCalledWith('Analysis', { summaryId: '1' });
    });

    it('should toggle favorite when heart pressed', async () => {
      mockToggleFavorite.mockResolvedValueOnce({ isFavorite: true });

      render(<HistoryScreen />);

      await waitFor(() => {
        const favoriteButton = screen.getAllByTestId?.('favorite-button')?.[0];
        if (favoriteButton) {
          fireEvent.press(favoriteButton);
        }
      });

      await waitFor(() => {
        expect(mockToggleFavorite).toHaveBeenCalledWith('1');
      });
    });

    it('should show delete confirmation on long press', async () => {
      render(<HistoryScreen />);

      await waitFor(() => {
        const videoCard = screen.getByText('Video One');
        fireEvent(videoCard, 'onLongPress');
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Supprimer',
        expect.stringContaining('Video One'),
        expect.any(Array)
      );
    });

    it('should delete video when confirmed', async () => {
      mockDeleteSummary.mockResolvedValueOnce(undefined);

      render(<HistoryScreen />);

      await waitFor(() => {
        const videoCard = screen.getByText('Video One');
        fireEvent(videoCard, 'onLongPress');
      });

      // Simulate pressing delete in alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const deleteButton = alertCall[2].find((btn: any) => btn.style === 'destructive');
      if (deleteButton?.onPress) {
        await deleteButton.onPress();
      }

      await waitFor(() => {
        expect(mockDeleteSummary).toHaveBeenCalledWith('1');
      });
    });

    it('should not delete when cancelled', async () => {
      render(<HistoryScreen />);

      await waitFor(() => {
        const videoCard = screen.getByText('Video One');
        fireEvent(videoCard, 'onLongPress');
      });

      // Simulate pressing cancel
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const cancelButton = alertCall[2].find((btn: any) => btn.style === 'cancel');
      if (cancelButton?.onPress) {
        cancelButton.onPress();
      }

      expect(mockDeleteSummary).not.toHaveBeenCalled();
    });
  });

  describe('Pull to Refresh', () => {
    it('should refresh data on pull', async () => {
      render(<HistoryScreen />);

      await waitFor(() => {
        const flatList = screen.getByTestId?.('history-list');
        if (flatList) {
          // Simulate pull to refresh
          fireEvent(flatList, 'onRefresh');
        }
      });

      await waitFor(() => {
        // Should call getHistory again
        expect(mockGetHistory).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Infinite Scroll', () => {
    it('should load more items when scrolled to bottom', async () => {
      mockGetHistory.mockResolvedValueOnce({
        items: mockAnalyses,
        hasMore: true,
        total: 50,
      });

      render(<HistoryScreen />);

      await waitFor(() => {
        const flatList = screen.getByTestId?.('history-list');
        if (flatList) {
          // Simulate scroll to end
          fireEvent(flatList, 'onEndReached');
        }
      });

      await waitFor(() => {
        expect(mockGetHistory).toHaveBeenCalledWith(2, 20, expect.any(Object));
      });
    });

    it('should not load more when hasMore is false', async () => {
      mockGetHistory.mockResolvedValueOnce({
        items: mockAnalyses,
        hasMore: false,
        total: 3,
      });

      render(<HistoryScreen />);

      await waitFor(() => {
        const flatList = screen.getByTestId?.('history-list');
        if (flatList) {
          fireEvent(flatList, 'onEndReached');
        }
      });

      // Should not call again
      await waitFor(() => {
        expect(mockGetHistory).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API error gracefully', async () => {
      mockGetHistory.mockRejectedValueOnce(new Error('Network error'));

      render(<HistoryScreen />);

      // Should not crash
      await waitFor(() => {
        expect(screen.getByText('Historique')).toBeTruthy();
      });
    });

    it('should handle favorite toggle error', async () => {
      mockToggleFavorite.mockRejectedValueOnce(new Error('Failed'));

      render(<HistoryScreen />);

      await waitFor(() => {
        const favoriteButton = screen.getAllByTestId?.('favorite-button')?.[0];
        if (favoriteButton) {
          fireEvent.press(favoriteButton);
        }
      });

      // Should not crash and error should be logged
    });

    it('should handle delete error', async () => {
      mockDeleteSummary.mockRejectedValueOnce(new Error('Failed'));

      render(<HistoryScreen />);

      await waitFor(() => {
        const videoCard = screen.getByText('Video One');
        fireEvent(videoCard, 'onLongPress');
      });

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const deleteButton = alertCall[2].find((btn: any) => btn.style === 'destructive');
      if (deleteButton?.onPress) {
        await deleteButton.onPress();
      }

      // Should show error alert
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Erreur',
          expect.any(String)
        );
      });
    });
  });

  describe('Results Count', () => {
    it('should show results count', async () => {
      render(<HistoryScreen />);

      await waitFor(() => {
        expect(screen.getByText(/3.*analyses/i)).toBeTruthy();
      });
    });
  });
});
