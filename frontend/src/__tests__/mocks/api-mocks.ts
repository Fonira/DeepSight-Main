/**
 * 🎭 Mocks API Complets — Tous les modules API avec factories
 * Remplace MSW pour les tests unitaires/store
 */

import { vi } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 TYPES & INTERFACES (Importés depuis le réel api.ts)
// ═══════════════════════════════════════════════════════════════════════════════

export interface User {
  id: number;
  email: string;
  username?: string;
  name?: string;
  avatar_url?: string;
  plan: "free" | "etudiant" | "starter" | "pro" | "equipe";
  credits: number;
  email_verified: boolean;
  created_at: string;
  subscription_active?: boolean;
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
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: { title: string; url: string }[];
  web_search_used?: boolean;
}

export interface AnalysisStatus {
  task_id: string;
  status: "pending" | "processing" | "complete" | "failed";
  progress?: number;
  summary?: Summary;
  error?: string;
  result_url?: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  analyses_per_month: number;
  credits_per_month: number;
  features: string[];
}

export interface Concept {
  word: string;
  definition: string;
  examples: string[];
  context: string;
}

export interface AcademicSource {
  id: string;
  title: string;
  authors: string[];
  year: number;
  url: string;
  doi?: string;
  abstract?: string;
  relevance_score: number;
}

export interface FactCheckResult {
  claim: string;
  verification: "verified" | "disputed" | "unverifiable";
  sources: AcademicSource[];
  explanation: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏭 DATA FACTORIES
// ═══════════════════════════════════════════════════════════════════════════════

export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 1,
  email: "user@test.com",
  username: "testuser",
  name: "Test User",
  avatar_url: "https://example.com/avatar.jpg",
  plan: "free",
  credits: 150,
  email_verified: true,
  created_at: new Date().toISOString(),
  subscription_active: false,
  ...overrides,
});

export const createMockSummary = (overrides?: Partial<Summary>): Summary => ({
  id: 1,
  video_id: "dQw4w9WgXcQ",
  video_title: "Test Video Title",
  video_channel: "Test Channel",
  video_duration: 3600,
  thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg",
  summary_content: "This is a test summary with comprehensive analysis.",
  transcript_context: "Full transcript context here...",
  category: "education",
  lang: "en",
  mode: "standard",
  model_used: "mistral-large",
  word_count: 450,
  created_at: new Date().toISOString(),
  tags: "test,education,analysis",
  is_favorite: false,
  ...overrides,
});

export const createMockChatMessage = (
  overrides?: Partial<ChatMessage>,
): ChatMessage => ({
  id: "msg-1",
  role: "user",
  content: "What is the main topic?",
  timestamp: new Date(),
  sources: [],
  web_search_used: false,
  ...overrides,
});

export const createMockAnalysisStatus = (
  overrides?: Partial<AnalysisStatus>,
): AnalysisStatus => ({
  task_id: "task-123",
  status: "pending",
  progress: 0,
  ...overrides,
});

export const createMockPlan = (overrides?: Partial<Plan>): Plan => ({
  id: "free",
  name: "Free Plan",
  price: 0,
  analyses_per_month: 3,
  credits_per_month: 150,
  features: ["Basic analysis", "Chat"],
  ...overrides,
});

export const createMockConcept = (overrides?: Partial<Concept>): Concept => ({
  word: "Photosynthesis",
  definition: "Process by which plants convert sunlight into chemical energy.",
  examples: ["Plants use photosynthesis to create glucose"],
  context: "biology",
  ...overrides,
});

export const createMockAcademicSource = (
  overrides?: Partial<AcademicSource>,
): AcademicSource => ({
  id: "paper-1",
  title: "A Study on Photosynthesis",
  authors: ["Dr. John Smith", "Dr. Jane Doe"],
  year: 2023,
  url: "https://example.com/paper-1",
  doi: "10.1234/example",
  abstract: "This paper studies photosynthesis in detail.",
  relevance_score: 0.95,
  ...overrides,
});

export const createMockFactCheckResult = (
  overrides?: Partial<FactCheckResult>,
): FactCheckResult => ({
  claim: "Plants need sunlight to survive",
  verification: "verified",
  sources: [createMockAcademicSource()],
  explanation: "This is verified by multiple scientific sources.",
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 AUTH API MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

export const mockAuthApi = {
  register: vi.fn(
    async (email: string, password: string, username?: string) => {
      return {
        message: "Registration successful",
        user: createMockUser({ email, username }),
      };
    },
  ),

  login: vi.fn(async (email: string, password: string) => {
    const result = {
      access_token: "access-token-test",
      refresh_token: "refresh-token-test",
      user: createMockUser({ email }),
    };
    // Mimic real behavior: store tokens
    try {
      localStorage.setItem("access_token", result.access_token);
      localStorage.setItem("refresh_token", result.refresh_token);
    } catch {
      /* */
    }
    return result;
  }),

  loginWithGoogle: vi.fn(async (token: string) => {
    return {
      access_token: "google-access-token",
      refresh_token: "google-refresh-token",
      user: createMockUser({ email: "google@test.com" }),
    };
  }),

  logout: vi.fn(async () => {
    return { message: "Logged out successfully" };
  }),

  me: vi.fn(async () => {
    return { user: createMockUser() };
  }),

  refresh: vi.fn(async () => {
    return {
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
    };
  }),

  verifyEmail: vi.fn(async (code: string) => {
    return { message: "Email verified successfully" };
  }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎬 VIDEO API MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

export const mockVideoApi = {
  analyze: vi.fn(
    async (videoUrl: string, preferences: Record<string, unknown> = {}) => {
      return { task_id: "task-" + Date.now() };
    },
  ),

  status: vi.fn(async (taskId: string) => {
    return createMockAnalysisStatus({ task_id: taskId, status: "complete" });
  }),

  getSummary: vi.fn(async (summaryId: number) => {
    return createMockSummary({ id: summaryId });
  }),

  history: vi.fn(async (page: number = 1, limit: number = 20) => {
    return {
      items: [createMockSummary(), createMockSummary({ id: 2 })],
      total: 42,
      page,
      limit,
    };
  }),

  export: vi.fn(async (summaryId: number, format: "pdf" | "docx" | "md") => {
    return { download_url: "https://example.com/export.pdf" };
  }),

  reliability: vi.fn(async (summaryId: number) => {
    return {
      overall_score: 0.87,
      concepts: [createMockConcept()],
      academic_sources: [createMockAcademicSource()],
      fact_checks: [createMockFactCheckResult()],
    };
  }),

  deleteSummary: vi.fn(async (summaryId: number) => {
    return { message: "Summary deleted" };
  }),

  toggleFavorite: vi.fn(async (summaryId: number) => {
    return { is_favorite: true };
  }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💬 CHAT API MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

export const mockChatApi = {
  ask: vi.fn(async (summaryId: number, question: string) => {
    return {
      message: createMockChatMessage({
        role: "assistant",
        content: "This is a test answer based on the summary.",
      }),
    };
  }),

  askStream: vi.fn(async (summaryId: number, question: string) => {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("Streaming response..."));
        controller.close();
      },
    });
  }),

  history: vi.fn(async (summaryId: number) => {
    return [
      createMockChatMessage({ role: "user" }),
      createMockChatMessage({ role: "assistant" }),
    ];
  }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💳 BILLING API MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

export const mockBillingApi = {
  checkout: vi.fn(async (planId: string) => {
    return { checkout_url: "https://checkout.stripe.com/test" };
  }),

  portal: vi.fn(async () => {
    return { portal_url: "https://billing.stripe.com/customer" };
  }),

  plans: vi.fn(async () => {
    return [
      createMockPlan({ id: "free", name: "Free" }),
      createMockPlan({ id: "pro", name: "Pro", price: 12.99 }),
    ];
  }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📚 PLAYLIST API MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

export const mockPlaylistApi = {
  create: vi.fn(async (name: string) => {
    return { id: 1, name, created_at: new Date().toISOString() };
  }),

  list: vi.fn(async () => {
    return [{ id: 1, name: "My Playlist", summary_count: 5 }];
  }),

  detail: vi.fn(async (playlistId: number) => {
    return {
      id: playlistId,
      name: "My Playlist",
      summaries: [createMockSummary()],
    };
  }),

  addSummary: vi.fn(async (playlistId: number, summaryId: number) => {
    return { message: "Summary added to playlist" };
  }),

  delete: vi.fn(async (playlistId: number) => {
    return { message: "Playlist deleted" };
  }),

  analyze: vi.fn(async (playlistId: number) => {
    return { task_id: "task-playlist-123" };
  }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔬 RELIABILITY API MOCKS
// ═══════════════════════════════════════════════════════════════════════════════

export const mockReliabilityApi = {
  factCheck: vi.fn(async (summaryId: number) => {
    return [createMockFactCheckResult()];
  }),

  concepts: vi.fn(async (summaryId: number) => {
    return [createMockConcept()];
  }),

  academicSources: vi.fn(async (summaryId: number) => {
    return [createMockAcademicSource()];
  }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 UNIFIED MOCK API OBJECT
// ═══════════════════════════════════════════════════════════════════════════════

export const mockApi = {
  auth: mockAuthApi,
  video: mockVideoApi,
  chat: mockChatApi,
  billing: mockBillingApi,
  playlist: mockPlaylistApi,
  reliability: mockReliabilityApi,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Réinitialise tous les mocks
 */
export const resetAllMocks = () => {
  // mockClear (pas mockReset) : garde l'implémentation par défaut, clear seulement les appels
  Object.values(mockAuthApi).forEach((fn) => fn.mockClear());
  Object.values(mockVideoApi).forEach((fn) => fn.mockClear());
  Object.values(mockChatApi).forEach((fn) => fn.mockClear());
  Object.values(mockBillingApi).forEach((fn) => fn.mockClear());
  Object.values(mockPlaylistApi).forEach((fn) => fn.mockClear());
  Object.values(mockReliabilityApi).forEach((fn) => fn.mockClear());
};

/**
 * Configure les mocks pour simuler une erreur réseau
 */
export const simulateNetworkError = () => {
  mockAuthApi.login.mockRejectedValueOnce(new Error("Network error"));
  mockVideoApi.analyze.mockRejectedValueOnce(new Error("Network error"));
};

/**
 * Configure les mocks pour simuler une erreur 401 (non authentifié)
 */
export const simulateUnauthorized = () => {
  mockAuthApi.me.mockRejectedValueOnce(new Error("Unauthorized"));
};

/**
 * Configure les mocks pour simuler un dépassement de limite de taux (429)
 */
export const simulateRateLimit = () => {
  mockVideoApi.analyze.mockRejectedValueOnce(
    Object.assign(new Error("Rate limited"), { status: 429 }),
  );
};
