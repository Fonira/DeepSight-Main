/**
 * Tests unitaires — Zustand Analysis Store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAnalysisStore } from '../analysisStore';
import type { Summary, VideoMetadata } from '../analysisStore';

// Helper: reset store between tests (don't use replace=true, it removes action functions)
function resetStore() {
  useAnalysisStore.setState({
    status: 'idle',
    progress: 0,
    progressMessage: '',
    currentSummary: null,
    streamingText: '',
    metadata: null,
    error: null,
    recentSummaries: [],
    favoriteSummaries: [],
    chatMessages: [],
    chatLoading: false,
    webSearchEnabled: false,
    preferences: {
      mode: 'standard',
      lang: 'fr',
      model: 'mistral-small-2603',
      category: 'auto',
      webEnrich: false,
    },
    chatOpen: false,
    playerVisible: false,
    playerStartTime: 0,
  });
}

const mockSummary: Summary = {
  id: 1,
  video_id: 'abc123',
  video_title: 'Test Video',
  video_channel: 'Test Channel',
  summary_content: 'This is a test summary',
  created_at: '2024-01-01T00:00:00Z',
};

const mockMetadata: VideoMetadata = {
  id: 'abc123',
  title: 'Test Video',
  channel: 'Test Channel',
  duration: 600,
  thumbnail: 'https://img.youtube.com/vi/abc123/0.jpg',
};

beforeEach(() => {
  resetStore();
});

// ═══════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════

describe('Initial State', () => {
  it('should have correct initial state', () => {
    const state = useAnalysisStore.getState();

    expect(state.status).toBe('idle');
    expect(state.progress).toBe(0);
    expect(state.progressMessage).toBe('');
    expect(state.currentSummary).toBeNull();
    expect(state.streamingText).toBe('');
    expect(state.metadata).toBeNull();
    expect(state.error).toBeNull();
    expect(state.recentSummaries).toEqual([]);
    expect(state.favoriteSummaries).toEqual([]);
    expect(state.chatMessages).toEqual([]);
    expect(state.chatLoading).toBe(false);
    expect(state.webSearchEnabled).toBe(false);
    expect(state.chatOpen).toBe(false);
    expect(state.playerVisible).toBe(false);
    expect(state.playerStartTime).toBe(0);
  });

  it('should have default preferences', () => {
    const { preferences } = useAnalysisStore.getState();

    expect(preferences.mode).toBe('standard');
    expect(preferences.lang).toBe('fr');
    expect(preferences.model).toBe('mistral-small-2603');
    expect(preferences.category).toBe('auto');
    expect(preferences.webEnrich).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ANALYSIS ACTIONS
// ═══════════════════════════════════════════════════════════════════════

describe('Analysis Actions', () => {
  it('startAnalysis sets status to loading', () => {
    useAnalysisStore.getState().startAnalysis('video123');

    const state = useAnalysisStore.getState();
    expect(state.status).toBe('loading');
    expect(state.progress).toBe(0);
    expect(state.error).toBeNull();
    expect(state.metadata).toBeNull();
    expect(state.chatMessages).toEqual([]);
  });

  it('updateProgress updates progress and message', () => {
    useAnalysisStore.getState().startAnalysis('video123');
    useAnalysisStore.getState().updateProgress(25, 'Extracting transcript...');

    const state = useAnalysisStore.getState();
    expect(state.progress).toBe(25);
    expect(state.progressMessage).toBe('Extracting transcript...');
  });

  it('updateProgress switches to streaming when progress > 30', () => {
    useAnalysisStore.getState().startAnalysis('video123');
    expect(useAnalysisStore.getState().status).toBe('loading');

    useAnalysisStore.getState().updateProgress(35, 'Generating summary...');
    expect(useAnalysisStore.getState().status).toBe('streaming');
  });

  it('appendStreamingText appends text and sets streaming status', () => {
    useAnalysisStore.getState().startAnalysis('video123');
    useAnalysisStore.getState().appendStreamingText('Hello ');
    useAnalysisStore.getState().appendStreamingText('world');

    const state = useAnalysisStore.getState();
    expect(state.streamingText).toBe('Hello world');
    expect(state.status).toBe('streaming');
  });

  it('setMetadata stores video metadata', () => {
    useAnalysisStore.getState().setMetadata(mockMetadata);

    expect(useAnalysisStore.getState().metadata).toEqual(mockMetadata);
  });

  it('completeAnalysis sets status to complete and stores summary', () => {
    useAnalysisStore.getState().startAnalysis('video123');
    useAnalysisStore.getState().appendStreamingText('some text');
    useAnalysisStore.getState().completeAnalysis(mockSummary);

    const state = useAnalysisStore.getState();
    expect(state.status).toBe('complete');
    expect(state.progress).toBe(100);
    expect(state.currentSummary).toEqual(mockSummary);
    expect(state.streamingText).toBe('');
  });

  it('completeAnalysis adds summary to recentSummaries', () => {
    useAnalysisStore.getState().completeAnalysis(mockSummary);

    expect(useAnalysisStore.getState().recentSummaries).toHaveLength(1);
    expect(useAnalysisStore.getState().recentSummaries[0].id).toBe(1);
  });

  it('completeAnalysis does not duplicate in recentSummaries', () => {
    useAnalysisStore.getState().completeAnalysis(mockSummary);
    useAnalysisStore.getState().completeAnalysis(mockSummary);

    expect(useAnalysisStore.getState().recentSummaries).toHaveLength(1);
  });

  it('completeAnalysis keeps max 20 recent summaries', () => {
    for (let i = 0; i < 25; i++) {
      useAnalysisStore.getState().completeAnalysis({ ...mockSummary, id: i });
    }

    expect(useAnalysisStore.getState().recentSummaries).toHaveLength(20);
    // Most recent should be first
    expect(useAnalysisStore.getState().recentSummaries[0].id).toBe(24);
  });

  it('failAnalysis sets error state', () => {
    useAnalysisStore.getState().startAnalysis('video123');
    useAnalysisStore.getState().failAnalysis('Video not found');

    const state = useAnalysisStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Video not found');
  });

  it('resetAnalysis restores idle state', () => {
    useAnalysisStore.getState().startAnalysis('video123');
    useAnalysisStore.getState().updateProgress(50, 'Working...');
    useAnalysisStore.getState().completeAnalysis(mockSummary);

    useAnalysisStore.getState().resetAnalysis();

    const state = useAnalysisStore.getState();
    expect(state.status).toBe('idle');
    expect(state.progress).toBe(0);
    expect(state.progressMessage).toBe('');
    expect(state.streamingText).toBe('');
    expect(state.error).toBeNull();
    expect(state.metadata).toBeNull();
    expect(state.currentSummary).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SUMMARY ACTIONS
// ═══════════════════════════════════════════════════════════════════════

describe('Summary Actions', () => {
  it('setSummary sets current summary and clears chat', () => {
    useAnalysisStore.getState().addChatMessage({ role: 'user', content: 'Hello' });
    useAnalysisStore.getState().setSummary(mockSummary);

    const state = useAnalysisStore.getState();
    expect(state.currentSummary).toEqual(mockSummary);
    expect(state.chatMessages).toEqual([]);
  });

  it('setSummary with null clears summary', () => {
    useAnalysisStore.getState().setSummary(mockSummary);
    useAnalysisStore.getState().setSummary(null);

    expect(useAnalysisStore.getState().currentSummary).toBeNull();
  });

  it('toggleFavorite toggles current summary favorite', () => {
    useAnalysisStore.getState().completeAnalysis(mockSummary);

    expect(useAnalysisStore.getState().currentSummary?.is_favorite).toBeFalsy();
    useAnalysisStore.getState().toggleFavorite(1);
    expect(useAnalysisStore.getState().currentSummary?.is_favorite).toBe(true);
  });

  it('toggleFavorite adds to favoriteSummaries', () => {
    useAnalysisStore.getState().completeAnalysis(mockSummary);
    useAnalysisStore.getState().toggleFavorite(1);

    expect(useAnalysisStore.getState().favoriteSummaries).toHaveLength(1);
  });

  it('toggleFavorite twice removes from favorites', () => {
    useAnalysisStore.getState().completeAnalysis(mockSummary);
    useAnalysisStore.getState().toggleFavorite(1);
    useAnalysisStore.getState().toggleFavorite(1);

    expect(useAnalysisStore.getState().favoriteSummaries).toHaveLength(0);
  });

  it('deleteSummary removes from all lists', () => {
    useAnalysisStore.getState().completeAnalysis(mockSummary);
    useAnalysisStore.getState().toggleFavorite(1);

    useAnalysisStore.getState().deleteSummary(1);

    const state = useAnalysisStore.getState();
    expect(state.recentSummaries).toHaveLength(0);
    expect(state.favoriteSummaries).toHaveLength(0);
    expect(state.currentSummary).toBeNull();
    expect(state.chatMessages).toEqual([]);
  });

  it('addToRecent adds without duplicates', () => {
    useAnalysisStore.getState().addToRecent(mockSummary);
    useAnalysisStore.getState().addToRecent(mockSummary);

    expect(useAnalysisStore.getState().recentSummaries).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CHAT ACTIONS
// ═══════════════════════════════════════════════════════════════════════

describe('Chat Actions', () => {
  it('addChatMessage adds message with auto-generated id and timestamp', () => {
    useAnalysisStore.getState().addChatMessage({ role: 'user', content: 'Hello' });

    const messages = useAnalysisStore.getState().chatMessages;
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Hello');
    expect(messages[0].id).toBeDefined();
    expect(messages[0].timestamp).toBeInstanceOf(Date);
  });

  it('clearChat removes all messages', () => {
    useAnalysisStore.getState().addChatMessage({ role: 'user', content: 'Hello' });
    useAnalysisStore.getState().addChatMessage({ role: 'assistant', content: 'Hi' });
    useAnalysisStore.getState().clearChat();

    expect(useAnalysisStore.getState().chatMessages).toEqual([]);
  });

  it('setChatLoading sets loading state', () => {
    useAnalysisStore.getState().setChatLoading(true);
    expect(useAnalysisStore.getState().chatLoading).toBe(true);

    useAnalysisStore.getState().setChatLoading(false);
    expect(useAnalysisStore.getState().chatLoading).toBe(false);
  });

  it('toggleWebSearch toggles state', () => {
    expect(useAnalysisStore.getState().webSearchEnabled).toBe(false);
    useAnalysisStore.getState().toggleWebSearch();
    expect(useAnalysisStore.getState().webSearchEnabled).toBe(true);
    useAnalysisStore.getState().toggleWebSearch();
    expect(useAnalysisStore.getState().webSearchEnabled).toBe(false);
  });

  it('toggleChat toggles state', () => {
    expect(useAnalysisStore.getState().chatOpen).toBe(false);
    useAnalysisStore.getState().toggleChat();
    expect(useAnalysisStore.getState().chatOpen).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PLAYER ACTIONS
// ═══════════════════════════════════════════════════════════════════════

describe('Player Actions', () => {
  it('showPlayer sets visible and start time', () => {
    useAnalysisStore.getState().showPlayer(120);

    const state = useAnalysisStore.getState();
    expect(state.playerVisible).toBe(true);
    expect(state.playerStartTime).toBe(120);
  });

  it('showPlayer defaults start time to 0', () => {
    useAnalysisStore.getState().showPlayer();

    expect(useAnalysisStore.getState().playerStartTime).toBe(0);
    expect(useAnalysisStore.getState().playerVisible).toBe(true);
  });

  it('hidePlayer hides player', () => {
    useAnalysisStore.getState().showPlayer(60);
    useAnalysisStore.getState().hidePlayer();

    expect(useAnalysisStore.getState().playerVisible).toBe(false);
  });

  it('seekTo updates start time', () => {
    useAnalysisStore.getState().seekTo(300);

    expect(useAnalysisStore.getState().playerStartTime).toBe(300);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PREFERENCES ACTIONS
// ═══════════════════════════════════════════════════════════════════════

describe('Preferences Actions', () => {
  it('setPreferences updates partially', () => {
    useAnalysisStore.getState().setPreferences({ lang: 'en', mode: 'expert' });

    const prefs = useAnalysisStore.getState().preferences;
    expect(prefs.lang).toBe('en');
    expect(prefs.mode).toBe('expert');
    expect(prefs.model).toBe('mistral-small-2603'); // unchanged
  });

  it('resetPreferences restores defaults', () => {
    useAnalysisStore.getState().setPreferences({ lang: 'en', mode: 'expert', model: 'mistral-large-2512' });
    useAnalysisStore.getState().resetPreferences();

    const prefs = useAnalysisStore.getState().preferences;
    expect(prefs.mode).toBe('standard');
    expect(prefs.lang).toBe('fr');
    expect(prefs.model).toBe('mistral-small-2603');
  });
});
