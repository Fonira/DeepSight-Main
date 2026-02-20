/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🗄️ Analysis Store — Zustand State Management                                      ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  FONCTIONNALITÉS:                                                                  ║
 * ║  • 📊 État global pour l'analyse en cours                                         ║
 * ║  • 💬 Gestion du chat et messages                                                 ║
 * ║  • 🎛️ Préférences utilisateur persistées                                          ║
 * ║  • 🔄 Computed values avec selectors optimisés                                    ║
 * ║  • 💾 Persistence localStorage optionnelle                                        ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface VideoMetadata {
  id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  publishDate?: string;
}

export interface Summary {
  id: number;
  video_id: string;
  video_title: string;
  video_channel: string;
  video_duration?: number;
  thumbnail_url?: string;
  summary_content: string;
  transcript_context?: string;
  category?: string;
  lang?: string;
  mode?: string;
  model_used?: string;
  word_count?: number;
  created_at: string;
  tags?: string;
  is_favorite?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: { title: string; url: string }[];
  web_search_used?: boolean;
}

export interface AnalysisPreferences {
  mode: 'accessible' | 'standard' | 'expert';
  lang: 'fr' | 'en';
  model: string;
  category: string;
  webEnrich: boolean;
}

export type AnalysisStatus = 
  | 'idle' 
  | 'loading' 
  | 'streaming' 
  | 'complete' 
  | 'error';

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 ANALYSIS STORE
// ═══════════════════════════════════════════════════════════════════════════════

interface AnalysisState {
  // Current analysis
  status: AnalysisStatus;
  progress: number;
  progressMessage: string;
  currentSummary: Summary | null;
  streamingText: string;
  metadata: VideoMetadata | null;
  error: string | null;
  
  // History
  recentSummaries: Summary[];
  favoriteSummaries: Summary[];
  
  // Chat
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  webSearchEnabled: boolean;
  
  // Preferences
  preferences: AnalysisPreferences;
  
  // UI State
  chatOpen: boolean;
  playerVisible: boolean;
  playerStartTime: number;
}

interface AnalysisActions {
  // Analysis actions
  startAnalysis: (videoId: string) => void;
  updateProgress: (progress: number, message: string) => void;
  appendStreamingText: (token: string) => void;
  setMetadata: (metadata: VideoMetadata) => void;
  completeAnalysis: (summary: Summary) => void;
  failAnalysis: (error: string) => void;
  resetAnalysis: () => void;
  
  // Summary actions
  setSummary: (summary: Summary | null) => void;
  toggleFavorite: (summaryId: number) => void;
  deleteSummary: (summaryId: number) => void;
  addToRecent: (summary: Summary) => void;
  
  // Chat actions
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChat: () => void;
  setChatLoading: (loading: boolean) => void;
  toggleWebSearch: () => void;
  toggleChat: () => void;
  
  // Player actions
  showPlayer: (startTime?: number) => void;
  hidePlayer: () => void;
  seekTo: (time: number) => void;
  
  // Preferences actions
  setPreferences: (prefs: Partial<AnalysisPreferences>) => void;
  resetPreferences: () => void;
}

type AnalysisStore = AnalysisState & AnalysisActions;

// ═══════════════════════════════════════════════════════════════════════════════
// 🏭 STORE IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_PREFERENCES: AnalysisPreferences = {
  mode: 'standard',
  lang: 'fr',
  model: 'mistral-small-latest',
  category: 'auto',
  webEnrich: false,
};

const INITIAL_STATE: AnalysisState = {
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
  preferences: DEFAULT_PREFERENCES,
  chatOpen: false,
  playerVisible: false,
  playerStartTime: 0,
};

export const useAnalysisStore = create<AnalysisStore>()(
  devtools(
    persist(
      immer((set, _get) => ({
        ...INITIAL_STATE,

        // ═══════════════════════════════════════════════════════════════════════
        // 🎬 ANALYSIS ACTIONS
        // ═══════════════════════════════════════════════════════════════════════
        
        startAnalysis: (_videoId: string) => {
          set((state) => {
            state.status = 'loading';
            state.progress = 0;
            state.progressMessage = '';
            state.streamingText = '';
            state.error = null;
            state.metadata = null;
            state.chatMessages = [];
          });
        },
        
        updateProgress: (progress: number, message: string) => {
          set((state) => {
            state.progress = progress;
            state.progressMessage = message;
            if (progress > 30 && state.status === 'loading') {
              state.status = 'streaming';
            }
          });
        },
        
        appendStreamingText: (token: string) => {
          set((state) => {
            state.streamingText += token;
            state.status = 'streaming';
          });
        },
        
        setMetadata: (metadata: VideoMetadata) => {
          set((state) => {
            state.metadata = metadata;
          });
        },
        
        completeAnalysis: (summary: Summary) => {
          set((state) => {
            state.status = 'complete';
            state.progress = 100;
            state.currentSummary = summary;
            state.streamingText = '';
            
            // Add to recent if not already present
            const exists = state.recentSummaries.some((s: Summary) => s.id === summary.id);
            if (!exists) {
              state.recentSummaries = [summary, ...state.recentSummaries.slice(0, 19)];
            }
          });
        },
        
        failAnalysis: (error: string) => {
          set((state) => {
            state.status = 'error';
            state.error = error;
          });
        },
        
        resetAnalysis: () => {
          set((state) => {
            state.status = 'idle';
            state.progress = 0;
            state.progressMessage = '';
            state.streamingText = '';
            state.error = null;
            state.metadata = null;
            state.currentSummary = null;
          });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // 📋 SUMMARY ACTIONS
        // ═══════════════════════════════════════════════════════════════════════
        
        setSummary: (summary: Summary | null) => {
          set((state) => {
            state.currentSummary = summary;
            state.chatMessages = []; // Clear chat when switching summaries
          });
        },
        
        toggleFavorite: (summaryId: number) => {
          set((state) => {
            // Toggle in current summary
            if (state.currentSummary?.id === summaryId) {
              state.currentSummary.is_favorite = !state.currentSummary.is_favorite;
            }
            
            // Toggle in recent
            const recentIdx = state.recentSummaries.findIndex((s: Summary) => s.id === summaryId);
            if (recentIdx !== -1) {
              const summary = state.recentSummaries[recentIdx];
              summary.is_favorite = !summary.is_favorite;
              
              // Update favorites list
              if (summary.is_favorite) {
                state.favoriteSummaries = [summary, ...state.favoriteSummaries];
              } else {
                state.favoriteSummaries = state.favoriteSummaries.filter((s: Summary) => s.id !== summaryId);
              }
            }
          });
        },
        
        deleteSummary: (summaryId: number) => {
          set((state) => {
            state.recentSummaries = state.recentSummaries.filter((s: Summary) => s.id !== summaryId);
            state.favoriteSummaries = state.favoriteSummaries.filter((s: Summary) => s.id !== summaryId);
            
            if (state.currentSummary?.id === summaryId) {
              state.currentSummary = null;
              state.chatMessages = [];
            }
          });
        },
        
        addToRecent: (summary: Summary) => {
          set((state) => {
            const exists = state.recentSummaries.some((s: Summary) => s.id === summary.id);
            if (!exists) {
              state.recentSummaries = [summary, ...state.recentSummaries.slice(0, 49)];
            }
          });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // 💬 CHAT ACTIONS
        // ═══════════════════════════════════════════════════════════════════════
        
        addChatMessage: (message) => {
          set((state) => {
            state.chatMessages.push({
              ...message,
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              timestamp: new Date(),
            });
          });
        },
        
        clearChat: () => {
          set((state) => {
            state.chatMessages = [];
          });
        },
        
        setChatLoading: (loading: boolean) => {
          set((state) => {
            state.chatLoading = loading;
          });
        },
        
        toggleWebSearch: () => {
          set((state) => {
            state.webSearchEnabled = !state.webSearchEnabled;
          });
        },
        
        toggleChat: () => {
          set((state) => {
            state.chatOpen = !state.chatOpen;
          });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // 🎬 PLAYER ACTIONS
        // ═══════════════════════════════════════════════════════════════════════
        
        showPlayer: (startTime = 0) => {
          set((state) => {
            state.playerVisible = true;
            state.playerStartTime = startTime;
          });
        },
        
        hidePlayer: () => {
          set((state) => {
            state.playerVisible = false;
          });
        },
        
        seekTo: (time: number) => {
          set((state) => {
            state.playerStartTime = time;
          });
        },

        // ═══════════════════════════════════════════════════════════════════════
        // ⚙️ PREFERENCES ACTIONS
        // ═══════════════════════════════════════════════════════════════════════
        
        setPreferences: (prefs: Partial<AnalysisPreferences>) => {
          set((state) => {
            state.preferences = { ...state.preferences, ...prefs };
          });
        },
        
        resetPreferences: () => {
          set((state) => {
            state.preferences = DEFAULT_PREFERENCES;
          });
        },
      })),
      {
        name: 'deepsight-analysis-store',
        storage: createJSONStorage(() => localStorage),
        // Only persist preferences and favorites
        partialize: (state) => ({
          preferences: state.preferences,
          favoriteSummaries: state.favoriteSummaries,
          recentSummaries: state.recentSummaries.slice(0, 20), // Keep only 20 most recent
        }),
      }
    ),
    { name: 'AnalysisStore' }
  )
);

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 SELECTORS (Optimized for re-renders)
// ═══════════════════════════════════════════════════════════════════════════════

export const useAnalysisStatus = () => useAnalysisStore((state) => state.status);
export const useAnalysisProgress = () => useAnalysisStore((state) => ({
  progress: state.progress,
  message: state.progressMessage,
}));
export const useCurrentSummary = () => useAnalysisStore((state) => state.currentSummary);
export const useStreamingText = () => useAnalysisStore((state) => state.streamingText);
export const useChatMessages = () => useAnalysisStore((state) => state.chatMessages);
export const useChatOpen = () => useAnalysisStore((state) => state.chatOpen);
export const usePreferences = () => useAnalysisStore((state) => state.preferences);
export const usePlayerState = () => useAnalysisStore((state) => ({
  visible: state.playerVisible,
  startTime: state.playerStartTime,
}));

// Computed selectors
export const useIsAnalyzing = () => useAnalysisStore((state) => 
  state.status === 'loading' || state.status === 'streaming'
);

export const useCanStartNewAnalysis = () => useAnalysisStore((state) =>
  state.status === 'idle' || state.status === 'complete' || state.status === 'error'
);

export const useFavoriteCount = () => useAnalysisStore((state) => 
  state.favoriteSummaries.length
);

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default useAnalysisStore;
