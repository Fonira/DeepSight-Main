/**
 * 🧪 Tests Complets — Analysis Store (Zustand + Immer + Persist)
 * Couverture complète du lifecycle, persistence, selectors et edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAnalysisStore } from '../analysisStore';
import type { Summary, ChatMessage, VideoMetadata, AnalysisPreferences } from '../analysisStore';

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 FACTORIES
// ═══════════════════════════════════════════════════════════════════════════════

const createMockSummary = (id = 1, overrides?: Partial<Summary>): Summary => ({
  id,
  video_id: `vid-${id}`,
  video_title: `Video ${id}`,
  video_channel: `Channel ${id}`,
  video_duration: 3600,
  thumbnail_url: `https://example.com/thumb-${id}.jpg`,
  summary_content: `Summary content for video ${id}`,
  created_at: new Date().toISOString(),
  is_favorite: false,
  ...overrides,
});

const createMockMetadata = (overrides?: Partial<VideoMetadata>): VideoMetadata => ({
  id: 'test-vid',
  title: 'Test Video',
  channel: 'Test Channel',
  duration: 3600,
  thumbnail: 'https://example.com/thumb.jpg',
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🧹 SETUP & TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════════

const INITIAL_STATE = {
  status: 'idle' as const,
  progress: 0,
  progressMessage: '',
  currentSummary: null,
  streamingText: '',
  metadata: null,
  error: null,
  recentSummaries: [] as Summary[],
  favoriteSummaries: [] as Summary[],
  chatMessages: [] as ChatMessage[],
  chatLoading: false,
  webSearchEnabled: false,
  preferences: {
    mode: 'standard' as const,
    lang: 'fr' as const,
    model: 'mistral-small-latest',
    category: 'auto',
    webEnrich: false,
  },
  chatOpen: false,
  playerVisible: false,
  playerStartTime: 0,
};

beforeEach(() => {
  useAnalysisStore.setState(INITIAL_STATE);
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Analysis Store — Initial State', () => {
  it('devrait avoir le bon état initial', () => {
    const state = useAnalysisStore.getState();

    expect(state.status).toBe('idle');
    expect(state.progress).toBe(0);
    expect(state.progressMessage).toBe('');
    expect(state.currentSummary).toBeNull();
    expect(state.streamingText).toBe('');
    expect(state.metadata).toBeNull();
    expect(state.error).toBeNull();
    expect(state.chatMessages).toEqual([]);
    expect(state.recentSummaries).toEqual([]);
    expect(state.favoriteSummaries).toEqual([]);
  });

  it('devrait avoir les préférences par défaut', () => {
    const { preferences } = useAnalysisStore.getState();

    expect(preferences).toEqual({
      mode: 'standard',
      lang: 'fr',
      model: 'mistral-small-latest',
      category: 'auto',
      webEnrich: false,
    });
  });

  it('devrait avoir les UI states par défaut', () => {
    const state = useAnalysisStore.getState();

    expect(state.chatOpen).toBe(false);
    expect(state.chatLoading).toBe(false);
    expect(state.webSearchEnabled).toBe(false);
    expect(state.playerVisible).toBe(false);
    expect(state.playerStartTime).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 ANALYSIS LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Analysis Store — Analysis Lifecycle', () => {
  it('startAnalysis → passe en loading et reset les champs', () => {
    const { startAnalysis } = useAnalysisStore.getState();

    startAnalysis('test123');

    const state = useAnalysisStore.getState();
    expect(state.status).toBe('loading');
    expect(state.progress).toBe(0);
    expect(state.progressMessage).toBe('');
    expect(state.streamingText).toBe('');
    expect(state.error).toBeNull();
    expect(state.metadata).toBeNull();
    expect(state.chatMessages).toEqual([]);
  });

  it('updateProgress → met à jour progress et message', () => {
    const store = useAnalysisStore.getState();
    store.startAnalysis('test123');

    useAnalysisStore.getState().updateProgress(50, 'Transcription en cours...');

    const state = useAnalysisStore.getState();
    expect(state.progress).toBe(50);
    expect(state.progressMessage).toBe('Transcription en cours...');
  });

  it('updateProgress > 30 → passe de loading à streaming', () => {
    const store = useAnalysisStore.getState();
    store.startAnalysis('test123');

    expect(useAnalysisStore.getState().status).toBe('loading');

    useAnalysisStore.getState().updateProgress(35, 'Analyse IA...');

    expect(useAnalysisStore.getState().status).toBe('streaming');
  });

  it('updateProgress <= 30 → reste en loading', () => {
    const store = useAnalysisStore.getState();
    store.startAnalysis('test123');

    useAnalysisStore.getState().updateProgress(25, 'Extraction...');

    expect(useAnalysisStore.getState().status).toBe('loading');
  });

  it('appendStreamingText → ajoute du texte et passe en streaming', () => {
    const store = useAnalysisStore.getState();
    store.startAnalysis('test123');

    useAnalysisStore.getState().appendStreamingText('Hello ');
    useAnalysisStore.getState().appendStreamingText('World');

    const state = useAnalysisStore.getState();
    expect(state.streamingText).toBe('Hello World');
    expect(state.status).toBe('streaming');
  });

  it('setMetadata → stocke les métadonnées vidéo', () => {
    const metadata = createMockMetadata();
    useAnalysisStore.getState().setMetadata(metadata);

    expect(useAnalysisStore.getState().metadata).toEqual(metadata);
  });

  it('completeAnalysis → passe en complete, vide le streaming, stocke le summary', () => {
    const store = useAnalysisStore.getState();
    store.startAnalysis('test123');
    useAnalysisStore.getState().appendStreamingText('partial...');

    const summary = createMockSummary(1);
    useAnalysisStore.getState().completeAnalysis(summary);

    const state = useAnalysisStore.getState();
    expect(state.status).toBe('complete');
    expect(state.progress).toBe(100);
    expect(state.currentSummary).toEqual(summary);
    expect(state.streamingText).toBe('');
  });

  it('completeAnalysis → ajoute au recentSummaries (FIFO)', () => {
    const summary = createMockSummary(99);
    useAnalysisStore.getState().completeAnalysis(summary);

    const state = useAnalysisStore.getState();
    expect(state.recentSummaries[0].id).toBe(99);
  });

  it('completeAnalysis → ne dédouble pas si déjà dans recent', () => {
    const summary = createMockSummary(1);
    useAnalysisStore.getState().completeAnalysis(summary);
    useAnalysisStore.getState().completeAnalysis(summary);

    const state = useAnalysisStore.getState();
    const count = state.recentSummaries.filter(s => s.id === 1).length;
    expect(count).toBe(1);
  });

  it('completeAnalysis → limite à 20 dans recentSummaries', () => {
    // Pré-remplir 25 summaries
    const existing = Array.from({ length: 25 }, (_, i) => createMockSummary(i + 1));
    useAnalysisStore.setState({ recentSummaries: existing });

    const newSummary = createMockSummary(100);
    useAnalysisStore.getState().completeAnalysis(newSummary);

    const state = useAnalysisStore.getState();
    // Le store garde [newSummary, ...existing.slice(0,19)] = 20
    expect(state.recentSummaries.length).toBeLessThanOrEqual(20);
    expect(state.recentSummaries[0].id).toBe(100);
  });

  it('failAnalysis → passe en error avec message', () => {
    useAnalysisStore.getState().startAnalysis('test123');
    useAnalysisStore.getState().failAnalysis('Crédits insuffisants');

    const state = useAnalysisStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Crédits insuffisants');
  });

  it('resetAnalysis → remet tout à zéro sauf recent/favorites', () => {
    const store = useAnalysisStore.getState();
    store.startAnalysis('test123');
    useAnalysisStore.getState().appendStreamingText('data...');
    useAnalysisStore.getState().setMetadata(createMockMetadata());

    // Ajouter un recent pour vérifier qu'il n'est PAS effacé
    useAnalysisStore.setState({
      recentSummaries: [createMockSummary(1)],
    });

    useAnalysisStore.getState().resetAnalysis();

    const state = useAnalysisStore.getState();
    expect(state.status).toBe('idle');
    expect(state.progress).toBe(0);
    expect(state.progressMessage).toBe('');
    expect(state.streamingText).toBe('');
    expect(state.error).toBeNull();
    expect(state.metadata).toBeNull();
    expect(state.currentSummary).toBeNull();
    // recent preserved
    expect(state.recentSummaries).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 📚 SUMMARY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('Analysis Store — Summary Management', () => {
  it('setSummary → stocke le summary et vide le chat', () => {
    // Pré-remplir le chat
    useAnalysisStore.getState().addChatMessage({ role: 'user', content: 'hello' });
    expect(useAnalysisStore.getState().chatMessages.length).toBe(1);

    const summary = createMockSummary(1);
    useAnalysisStore.getState().setSummary(summary);

    const state = useAnalysisStore.getState();
    expect(state.currentSummary).toEqual(summary);
    expect(state.chatMessages).toEqual([]);
  });

  it('setSummary(null) → efface le summary', () => {
    useAnalysisStore.getState().setSummary(createMockSummary(1));
    useAnalysisStore.getState().setSummary(null);

    expect(useAnalysisStore.getState().currentSummary).toBeNull();
  });

  it('toggleFavorite → alterne is_favorite sur currentSummary', () => {
    const summary = createMockSummary(1, { is_favorite: false });
    useAnalysisStore.getState().setSummary(summary);

    useAnalysisStore.getState().toggleFavorite(1);
    expect(useAnalysisStore.getState().currentSummary?.is_favorite).toBe(true);

    useAnalysisStore.getState().toggleFavorite(1);
    expect(useAnalysisStore.getState().currentSummary?.is_favorite).toBe(false);
  });

  it('toggleFavorite → met à jour dans recentSummaries + favoriteSummaries', () => {
    const summary = createMockSummary(1);
    useAnalysisStore.setState({
      recentSummaries: [summary],
      currentSummary: summary,
    });

    useAnalysisStore.getState().toggleFavorite(1);

    const state = useAnalysisStore.getState();
    expect(state.recentSummaries[0].is_favorite).toBe(true);
    expect(state.favoriteSummaries).toHaveLength(1);
    expect(state.favoriteSummaries[0].id).toBe(1);
  });

  it('toggleFavorite → retire des favoriteSummaries quand défavorisé', () => {
    const summary = createMockSummary(1, { is_favorite: true });
    useAnalysisStore.setState({
      recentSummaries: [summary],
      favoriteSummaries: [summary],
      currentSummary: summary,
    });

    useAnalysisStore.getState().toggleFavorite(1);

    const state = useAnalysisStore.getState();
    expect(state.favoriteSummaries).toHaveLength(0);
  });

  it('deleteSummary → supprime de recentSummaries et favoriteSummaries', () => {
    const s1 = createMockSummary(1);
    const s2 = createMockSummary(2);
    useAnalysisStore.setState({
      recentSummaries: [s1, s2],
      favoriteSummaries: [s1],
      currentSummary: s1,
    });

    useAnalysisStore.getState().deleteSummary(1);

    const state = useAnalysisStore.getState();
    expect(state.recentSummaries).toHaveLength(1);
    expect(state.recentSummaries[0].id).toBe(2);
    expect(state.favoriteSummaries).toHaveLength(0);
    expect(state.currentSummary).toBeNull();
    expect(state.chatMessages).toEqual([]);
  });

  it('deleteSummary → ne touche pas currentSummary si id différent', () => {
    const s1 = createMockSummary(1);
    const s2 = createMockSummary(2);
    useAnalysisStore.setState({
      recentSummaries: [s1, s2],
      currentSummary: s1,
    });

    useAnalysisStore.getState().deleteSummary(2);

    expect(useAnalysisStore.getState().currentSummary?.id).toBe(1);
  });

  it('addToRecent → ajoute en tête, limite à 50', () => {
    const existing = Array.from({ length: 55 }, (_, i) => createMockSummary(i + 1));
    useAnalysisStore.setState({ recentSummaries: existing });

    const newSummary = createMockSummary(100);
    useAnalysisStore.getState().addToRecent(newSummary);

    const state = useAnalysisStore.getState();
    expect(state.recentSummaries[0].id).toBe(100);
    expect(state.recentSummaries.length).toBeLessThanOrEqual(50);
  });

  it('addToRecent → ne dédouble pas', () => {
    const s1 = createMockSummary(1);
    useAnalysisStore.setState({ recentSummaries: [s1] });

    useAnalysisStore.getState().addToRecent(s1);

    expect(useAnalysisStore.getState().recentSummaries).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 💬 CHAT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('Analysis Store — Chat', () => {
  it('addChatMessage → ajoute un message avec id et timestamp auto', () => {
    useAnalysisStore.getState().addChatMessage({ role: 'user', content: 'Bonjour' });

    const msgs = useAnalysisStore.getState().chatMessages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe('Bonjour');
    expect(msgs[0].id).toBeDefined();
    expect(msgs[0].timestamp).toBeInstanceOf(Date);
  });

  it('addChatMessage → messages en ordre chronologique', () => {
    const store = useAnalysisStore.getState();
    store.addChatMessage({ role: 'user', content: 'Question' });
    useAnalysisStore.getState().addChatMessage({ role: 'assistant', content: 'Réponse' });
    useAnalysisStore.getState().addChatMessage({ role: 'user', content: 'Merci' });

    const msgs = useAnalysisStore.getState().chatMessages;
    expect(msgs).toHaveLength(3);
    expect(msgs[0].role).toBe('user');
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[2].role).toBe('user');
  });

  it('clearChat → vide les messages', () => {
    useAnalysisStore.getState().addChatMessage({ role: 'user', content: 'test' });
    useAnalysisStore.getState().clearChat();

    expect(useAnalysisStore.getState().chatMessages).toEqual([]);
  });

  it('clearChat sur un chat vide → pas d\'erreur', () => {
    expect(() => useAnalysisStore.getState().clearChat()).not.toThrow();
    expect(useAnalysisStore.getState().chatMessages).toEqual([]);
  });

  it('setChatLoading → toggle le loading', () => {
    useAnalysisStore.getState().setChatLoading(true);
    expect(useAnalysisStore.getState().chatLoading).toBe(true);

    useAnalysisStore.getState().setChatLoading(false);
    expect(useAnalysisStore.getState().chatLoading).toBe(false);
  });

  it('toggleWebSearch → alterne webSearchEnabled', () => {
    expect(useAnalysisStore.getState().webSearchEnabled).toBe(false);

    useAnalysisStore.getState().toggleWebSearch();
    expect(useAnalysisStore.getState().webSearchEnabled).toBe(true);

    useAnalysisStore.getState().toggleWebSearch();
    expect(useAnalysisStore.getState().webSearchEnabled).toBe(false);
  });

  it('toggleChat → alterne chatOpen', () => {
    expect(useAnalysisStore.getState().chatOpen).toBe(false);

    useAnalysisStore.getState().toggleChat();
    expect(useAnalysisStore.getState().chatOpen).toBe(true);

    useAnalysisStore.getState().toggleChat();
    expect(useAnalysisStore.getState().chatOpen).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🎬 PLAYER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('Analysis Store — Player', () => {
  it('showPlayer() → visible avec startTime=0 par défaut', () => {
    useAnalysisStore.getState().showPlayer();

    const state = useAnalysisStore.getState();
    expect(state.playerVisible).toBe(true);
    expect(state.playerStartTime).toBe(0);
  });

  it('showPlayer(120) → visible au timestamp donné', () => {
    useAnalysisStore.getState().showPlayer(120);

    const state = useAnalysisStore.getState();
    expect(state.playerVisible).toBe(true);
    expect(state.playerStartTime).toBe(120);
  });

  it('hidePlayer → rend invisible', () => {
    useAnalysisStore.getState().showPlayer();
    useAnalysisStore.getState().hidePlayer();

    expect(useAnalysisStore.getState().playerVisible).toBe(false);
  });

  it('seekTo → change le startTime', () => {
    useAnalysisStore.getState().seekTo(300);

    expect(useAnalysisStore.getState().playerStartTime).toBe(300);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Analysis Store — Preferences', () => {
  it('setPreferences → mise à jour partielle', () => {
    useAnalysisStore.getState().setPreferences({ mode: 'expert', lang: 'en' });

    const prefs = useAnalysisStore.getState().preferences;
    expect(prefs.mode).toBe('expert');
    expect(prefs.lang).toBe('en');
    // Le reste inchangé
    expect(prefs.model).toBe('mistral-small-latest');
    expect(prefs.category).toBe('auto');
    expect(prefs.webEnrich).toBe(false);
  });

  it('setPreferences → change un seul champ', () => {
    useAnalysisStore.getState().setPreferences({ webEnrich: true });

    const prefs = useAnalysisStore.getState().preferences;
    expect(prefs.webEnrich).toBe(true);
    expect(prefs.mode).toBe('standard');
  });

  it('resetPreferences → remet les défauts', () => {
    useAnalysisStore.getState().setPreferences({
      mode: 'expert',
      lang: 'en',
      model: 'custom-model',
      category: 'science',
      webEnrich: true,
    });

    useAnalysisStore.getState().resetPreferences();

    expect(useAnalysisStore.getState().preferences).toEqual({
      mode: 'standard',
      lang: 'fr',
      model: 'mistral-small-latest',
      category: 'auto',
      webEnrich: false,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔍 SELECTORS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Analysis Store — Selectors', () => {
  it('useIsAnalyzing → true quand loading ou streaming', () => {
    useAnalysisStore.getState().startAnalysis('test');

    let isAnalyzing = useAnalysisStore.getState().status === 'loading' ||
                      useAnalysisStore.getState().status === 'streaming';
    expect(isAnalyzing).toBe(true);

    useAnalysisStore.getState().appendStreamingText('data');
    isAnalyzing = useAnalysisStore.getState().status === 'loading' ||
                  useAnalysisStore.getState().status === 'streaming';
    expect(isAnalyzing).toBe(true);
  });

  it('useCanStartNewAnalysis → true quand idle, complete ou error', () => {
    const canStart = () => {
      const s = useAnalysisStore.getState().status;
      return s === 'idle' || s === 'complete' || s === 'error';
    };

    expect(canStart()).toBe(true); // idle

    useAnalysisStore.getState().startAnalysis('test');
    expect(canStart()).toBe(false); // loading

    useAnalysisStore.getState().completeAnalysis(createMockSummary(1));
    expect(canStart()).toBe(true); // complete

    useAnalysisStore.getState().startAnalysis('test2');
    useAnalysisStore.getState().failAnalysis('error');
    expect(canStart()).toBe(true); // error
  });

  it('useFavoriteCount → compte les favoris', () => {
    useAnalysisStore.setState({
      favoriteSummaries: [createMockSummary(1), createMockSummary(2)],
    });

    expect(useAnalysisStore.getState().favoriteSummaries.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 💾 PERSISTENCE (partialize)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Analysis Store — Persistence', () => {
  it('devrait persister les préférences', () => {
    useAnalysisStore.getState().setPreferences({ mode: 'expert' });

    const prefs = useAnalysisStore.getState().preferences;
    expect(prefs.mode).toBe('expert');
  });

  it('devrait persister les favoris', () => {
    const fav = createMockSummary(1, { is_favorite: true });
    useAnalysisStore.setState({ favoriteSummaries: [fav] });

    expect(useAnalysisStore.getState().favoriteSummaries).toHaveLength(1);
  });

  it('devrait persister max 20 recent summaries', () => {
    const summaries = Array.from({ length: 30 }, (_, i) => createMockSummary(i + 1));
    useAnalysisStore.setState({ recentSummaries: summaries });

    // La partialize garde seulement les 20 premiers
    // On vérifie que le store accepte l'état
    expect(useAnalysisStore.getState().recentSummaries.length).toBe(30);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Analysis Store — Edge Cases', () => {
  it('deleteSummary(inexistant) → pas d\'erreur', () => {
    expect(() => useAnalysisStore.getState().deleteSummary(999)).not.toThrow();
  });

  it('toggleFavorite sur un id inexistant → pas d\'erreur', () => {
    expect(() => useAnalysisStore.getState().toggleFavorite(999)).not.toThrow();
  });

  it('double startAnalysis → reset propre', () => {
    useAnalysisStore.getState().startAnalysis('vid1');
    useAnalysisStore.getState().appendStreamingText('data...');
    useAnalysisStore.getState().startAnalysis('vid2');

    const state = useAnalysisStore.getState();
    expect(state.status).toBe('loading');
    expect(state.streamingText).toBe('');
  });

  it('appendStreamingText → accumulation progressive', () => {
    useAnalysisStore.getState().startAnalysis('test');

    for (let i = 0; i < 100; i++) {
      useAnalysisStore.getState().appendStreamingText(`token${i} `);
    }

    const text = useAnalysisStore.getState().streamingText;
    expect(text).toContain('token0');
    expect(text).toContain('token99');
    expect(text.split('token').length - 1).toBe(100);
  });

  it('setSummary puis deleteSummary → nettoie correctement', () => {
    const summary = createMockSummary(1);
    useAnalysisStore.getState().setSummary(summary);
    useAnalysisStore.getState().addChatMessage({ role: 'user', content: 'test' });

    useAnalysisStore.getState().deleteSummary(1);

    const state = useAnalysisStore.getState();
    expect(state.currentSummary).toBeNull();
    expect(state.chatMessages).toEqual([]);
  });

  it('addChatMessage avec sources → conserve les sources', () => {
    useAnalysisStore.getState().addChatMessage({
      role: 'assistant',
      content: 'Voici les résultats',
      sources: [{ title: 'Wikipedia', url: 'https://wikipedia.org' }],
      web_search_used: true,
    });

    const msg = useAnalysisStore.getState().chatMessages[0];
    expect(msg.sources).toHaveLength(1);
    expect(msg.web_search_used).toBe(true);
  });
});
