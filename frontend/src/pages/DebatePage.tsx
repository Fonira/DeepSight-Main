/**
 * DebatePage — Page principale Débat IA
 * Affiche le formulaire de création, la liste des débats passés, ou le détail d'un débat
 * Connecté à l'API /api/debate/* avec fallback mock pour le dev
 *
 * v2.0 — Refonte design : DoodleBackground, Sidebar, DoodleDivider, DoodleEmptyState
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useSearchParams, useParams } from "react-router-dom";
import {
  Swords,
  ArrowLeft,
  FileText,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { DeepSightSpinnerSmall } from "../components/ui/DeepSightSpinner";
import {
  DebateCreateForm,
  DebateVSLayout,
  DebateConvergenceDivergence,
  DebateFactCheck,
  DebateStatusTracker,
  DebateSummaryCard,
  DebateChat,
} from "../components/debate";
import { debateApi, ApiError } from "../services/api";
import type { DebateAnalysis, DebateListItem } from "../types/debate";
import { Sidebar } from "../components/layout/Sidebar";
import DoodleBackground from "../components/DoodleBackground";
import { DoodleDivider } from "../components/doodles";
import DoodleEmptyState from "../components/doodles/DoodleEmptyState";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { VoiceModal } from "../components/voice/VoiceModal";
import { DebateVoiceHero } from "../components/voice/DebateVoiceHero";
import { useVoiceChat } from "../components/voice/useVoiceChat";
import { useMicLevel } from "../components/voice/hooks/useMicLevel";
import { useAuth } from "../hooks/useAuth";
import { PLAN_LIMITS, normalizePlanId } from "../config/planPrivileges";

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATA — Fallback pour dev quand l'API n'est pas dispo
// ═══════════════════════════════════════════════════════════════════════════════

const MOCK_DEBATE: DebateAnalysis = {
  id: 1,
  video_a_id: "dQw4w9WgXcQ",
  video_b_id: "jNQXAC9IVRw",
  platform_a: "youtube",
  platform_b: "youtube",
  video_a_title: "Pourquoi l'IA ne remplacera JAMAIS les développeurs",
  video_b_title:
    "Les développeurs vont disparaître d'ici 5 ans — voici pourquoi",
  video_a_channel: "CodeAvecHugo",
  video_b_channel: "TechVision FR",
  video_a_thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  video_b_thumbnail: "https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg",
  detected_topic:
    "L'intelligence artificielle va-t-elle remplacer les développeurs ?",
  thesis_a:
    "L'IA est un outil puissant mais fondamentalement limité : elle ne peut pas comprendre le contexte métier, innover, ni prendre des décisions architecturales complexes. Les développeurs resteront indispensables.",
  thesis_b:
    "L'IA progresse de manière exponentielle. Dans 5 ans, 80% du code sera généré automatiquement. Les développeurs qui ne s'adaptent pas seront remplacés par des non-développeurs utilisant l'IA.",
  arguments_a: [
    {
      claim: "L'IA ne comprend pas le contexte métier",
      evidence:
        "Les LLMs génèrent du code syntaxiquement correct mais échouent régulièrement sur des règles métier complexes. Étude GitHub 2025 : seuls 37% des suggestions Copilot sont acceptées en production.",
      strength: "strong",
    },
    {
      claim: "L'architecture logicielle nécessite une vision humaine",
      evidence:
        "Les choix d'architecture (microservices vs monolithe, patterns de scalabilité) dépendent de contraintes organisationnelles, budgétaires et humaines que l'IA ne peut pas évaluer.",
      strength: "strong",
    },
    {
      claim:
        "Chaque révolution technologique a créé plus d'emplois qu'elle n'en a détruit",
      evidence:
        "Historiquement, l'automatisation (industrie, informatique) a toujours déplacé les emplois vers des tâches à plus haute valeur ajoutée. Le même phénomène se reproduira.",
      strength: "moderate",
    },
    {
      claim: "Le debugging et la maintenance restent humains",
      evidence:
        "Les bugs les plus coûteux sont des erreurs de logique et d'intégration que l'IA peine à identifier. Le debugging nécessite une compréhension globale du système.",
      strength: "moderate",
    },
  ],
  arguments_b: [
    {
      claim: "Les progrès de l'IA sont exponentiels",
      evidence:
        "GPT-4 (2023) a passé l'examen du barreau. Claude et Gemini 2.0 résolvent des problèmes de compétition de programmation. La courbe de progression n'est pas linéaire.",
      strength: "strong",
    },
    {
      claim: "Les outils no-code/low-code explosent",
      evidence:
        "Le marché no-code atteindra 65 milliards $ en 2027 (Gartner). Des non-développeurs créent déjà des applications complètes avec Cursor, Bolt et Replit Agent.",
      strength: "moderate",
    },
    {
      claim: "Les entreprises veulent réduire les coûts de développement",
      evidence:
        "McKinsey estime que l'IA générative peut automatiser 70% des tâches de développement d'ici 2030, ce qui pousse les entreprises à investir massivement.",
      strength: "moderate",
    },
    {
      claim: "Les juniors seront les premiers touchés",
      evidence:
        "Les tâches juniors (CRUD, intégration API, UI basique) sont déjà automatisables. Le marché de l'emploi junior dev se contracte dans la Silicon Valley depuis 2024.",
      strength: "weak",
    },
  ],
  convergence_points: [
    "L'IA transforme profondément le métier de développeur — les deux vidéos s'accordent sur le fait que le rôle va évoluer significativement.",
    "Les développeurs qui refusent d'utiliser l'IA seront désavantagés. La maîtrise des outils IA devient une compétence essentielle.",
  ],
  divergence_points: [
    {
      topic: "Horizon temporel du remplacement",
      position_a:
        "Pas de remplacement envisageable, même à long terme. L'IA restera un outil assistant.",
      position_b:
        "80% du code sera auto-généré d'ici 2030. Le métier disparaîtra sous sa forme actuelle.",
      fact_check_verdict:
        "Les projections varient énormément selon les sources. Pas de consensus scientifique.",
    },
    {
      topic: "Capacité de l'IA à comprendre le contexte",
      position_a:
        "L'IA ne peut pas comprendre les nuances métier et les contraintes organisationnelles.",
      position_b:
        "Les modèles RAG et agents autonomes comblent rapidement ce fossé de compréhension.",
    },
    {
      topic: "Impact sur le marché de l'emploi",
      position_a:
        "Création nette d'emplois, comme toute révolution industrielle précédente.",
      position_b:
        "Destruction massive d'emplois juniors/mid, concentration sur les profils seniors.",
      fact_check_verdict:
        "Les données actuelles montrent un ralentissement des embauches junior mais pas de destruction massive.",
    },
  ],
  fact_check_results: [
    {
      claim: "37% des suggestions Copilot sont acceptées en production",
      verdict: "nuanced",
      source: "https://github.blog/2024-copilot-research",
      explanation:
        "Le chiffre exact varie selon les études : GitHub rapporte 30% d'acceptation globale (2024), mais le taux monte à 46% pour les tâches boilerplate. Le chiffre de 37% est plausible mais daté.",
    },
    {
      claim: "Le marché no-code atteindra 65 milliards $ en 2027",
      verdict: "confirmed",
      source:
        "https://www.gartner.com/en/newsroom/press-releases/low-code-2027",
      explanation:
        "Gartner prévoit effectivement 65,15 milliards $ pour le marché des plateformes low-code/no-code en 2027, avec un taux de croissance annuel de 20%.",
    },
    {
      claim: "McKinsey estime 70% d'automatisation des tâches dev d'ici 2030",
      verdict: "disputed",
      source: "https://www.mckinsey.com/capabilities/quantumblack/our-insights",
      explanation:
        "Le rapport McKinsey 2024 parle de 60-70% de potentiel d'automatisation pour les tâches codage routinières, pas pour l'ensemble du travail de développement. C'est une extrapolation trompeuse.",
    },
    {
      claim:
        "Le marché de l'emploi junior dev se contracte dans la Silicon Valley",
      verdict: "nuanced",
      source: "https://www.levels.fyi/2025-report",
      explanation:
        "Les offres d'emploi junior ont effectivement baissé de 30% en 2024-2025 en Californie, mais cette baisse est aussi liée aux corrections post-COVID et aux taux d'intérêt, pas uniquement à l'IA.",
    },
  ],
  debate_summary:
    "Ce débat révèle un clivage classique entre techno-optimistes et techno-réalistes. Les deux camps s'accordent sur la transformation profonde du métier, mais divergent sur l'ampleur et la vitesse du changement. Les fact-checks montrent que les deux parties utilisent des données partiellement correctes mais souvent extrapolées. La réalité se situe probablement entre les deux : l'IA ne remplacera pas les développeurs, mais transformera radicalement ce que signifie « développer ».",
  status: "completed",
  mode: "auto",
  lang: "fr",
  created_at: "2026-03-20T14:30:00Z",
};

const MOCK_IN_PROGRESS: DebateAnalysis = {
  ...MOCK_DEBATE,
  id: 2,
  status: "comparing",
  detected_topic: "Le télétravail est-il plus productif que le présentiel ?",
  video_a_title: "Le télétravail, c'est la liberté : 3 ans de recul",
  video_b_title: "Pourquoi les entreprises rappellent tout le monde au bureau",
  video_a_channel: "Freelance Life",
  video_b_channel: "Management Today FR",
  created_at: "2026-03-20T16:00:00Z",
};

const MOCK_DEBATES_LIST: DebateListItem[] = [
  {
    id: MOCK_DEBATE.id,
    detected_topic: MOCK_DEBATE.detected_topic,
    video_a_title: MOCK_DEBATE.video_a_title,
    video_b_title: MOCK_DEBATE.video_b_title,
    video_a_thumbnail: MOCK_DEBATE.video_a_thumbnail,
    video_b_thumbnail: MOCK_DEBATE.video_b_thumbnail,
    status: MOCK_DEBATE.status,
    created_at: MOCK_DEBATE.created_at,
  },
  {
    id: MOCK_IN_PROGRESS.id,
    detected_topic: MOCK_IN_PROGRESS.detected_topic,
    video_a_title: MOCK_IN_PROGRESS.video_a_title,
    video_b_title: MOCK_IN_PROGRESS.video_b_title,
    video_a_thumbnail: MOCK_IN_PROGRESS.video_a_thumbnail,
    video_b_thumbnail: MOCK_IN_PROGRESS.video_b_thumbnail,
    status: MOCK_IN_PROGRESS.status,
    created_at: MOCK_IN_PROGRESS.created_at,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// POLLING INTERVAL
// ═══════════════════════════════════════════════════════════════════════════════

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_RETRIES = 3;
// Backoff sequence for poll retries: 1s, 2s, 4s (exponential, max 3 attempts)
const POLL_RETRY_BACKOFF_MS = [1000, 2000, 4000];

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR MESSAGE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Translates an unknown error (typically an ApiError) into a user-facing French message.
 * Distinguishes network / auth / rate-limited / server / other states.
 */
const getApiErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof ApiError) {
    // status === 0 → fetch failed before reaching server (offline, DNS, CORS, abort)
    if (err.status === 0) {
      return "Erreur de connexion réseau — vérifie ta connexion";
    }
    // status === 408 → AbortController timeout
    if (err.status === 408) {
      return "Délai d'attente dépassé — réessaie";
    }
    if (err.status === 401) {
      return "Session expirée — reconnecte-toi";
    }
    if (err.status === 429) {
      return "Trop de requêtes, attends quelques secondes";
    }
    if (err.status >= 500 && err.status < 600) {
      return "Erreur serveur — réessaie dans une minute";
    }
    // Other 4xx — use the API-translated message if non-empty
    if (err.message && err.message.trim().length > 0) {
      return err.message;
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEBATE PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export const DebatePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: routeId } = useParams<{ id?: string }>();

  // Debate ID from either route param (/debate/:id) or search param (?id=X)
  const debateId = routeId || searchParams.get("id");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDebate, setSelectedDebate] = useState<DebateAnalysis | null>(
    null,
  );
  const [debateLoading, setDebateLoading] = useState(false);
  const [debatesList, setDebatesList] = useState<DebateListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  // Dev-only mock fallback. Production users see explicit error states instead
  // of silent mock data — see loadHistory() / handleCreateDebate() below.
  const [devMockEnabled, setDevMockEnabled] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRetryCountRef = useRef<number>(0);
  const pollRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // 🎙️ Voice Chat — Debate moderator agent
  const { user } = useAuth();
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [avatarData, setAvatarData] = useState<{
    url: string | null;
    status: "ready" | "generating" | "unavailable";
  }>({ url: null, status: "unavailable" });
  const avatarPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const voiceChat = useVoiceChat({
    debateId: selectedDebate?.id,
    agentType: "debate_moderator",
    language: "fr",
  });
  const micLevel = useMicLevel(voiceChat.micStream, voiceChat.isTalking);

  const ADMIN_EMAIL_VOICE = "maximeleparc3@gmail.com";
  const isAdminVoice =
    user?.is_admin ||
    user?.email?.toLowerCase() === ADMIN_EMAIL_VOICE.toLowerCase();
  const voiceEnabled =
    isAdminVoice || PLAN_LIMITS[normalizePlanId(user?.plan)].voiceChatEnabled;

  // ─── Cleanup polling on unmount ───
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (pollRetryTimeoutRef.current)
        clearTimeout(pollRetryTimeoutRef.current);
      if (avatarPollRef.current) clearInterval(avatarPollRef.current);
    };
  }, []);

  // ─── Stable stopPolling helper (declared before consumers) ───
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (pollRetryTimeoutRef.current) {
      clearTimeout(pollRetryTimeoutRef.current);
      pollRetryTimeoutRef.current = null;
    }
  }, []);

  // ─── Fetch agent voice avatar when debate completes ───
  useEffect(() => {
    // Stop any running poll
    if (avatarPollRef.current) {
      clearInterval(avatarPollRef.current);
      avatarPollRef.current = null;
    }

    if (
      !selectedDebate ||
      selectedDebate.status !== "completed" ||
      !voiceEnabled
    ) {
      setAvatarData({ url: null, status: "unavailable" });
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 12; // ~60s at 5s interval

    const fetchAvatar = async () => {
      try {
        const res = await debateApi.getVoiceAvatar(selectedDebate.id);
        if (cancelled) return;
        setAvatarData({ url: res.url, status: res.status });
        if (res.status === "generating" && attempts < MAX_ATTEMPTS) {
          // Schedule poll
          if (!avatarPollRef.current) {
            avatarPollRef.current = setInterval(async () => {
              attempts += 1;
              try {
                const r = await debateApi.getVoiceAvatar(selectedDebate.id);
                if (cancelled) return;
                setAvatarData({ url: r.url, status: r.status });
                if (r.status !== "generating" || attempts >= MAX_ATTEMPTS) {
                  if (avatarPollRef.current) {
                    clearInterval(avatarPollRef.current);
                    avatarPollRef.current = null;
                  }
                }
              } catch {
                /* swallow — keep trying until MAX_ATTEMPTS */
              }
            }, 5000);
          }
        }
      } catch {
        if (!cancelled) setAvatarData({ url: null, status: "unavailable" });
      }
    };

    fetchAvatar();

    return () => {
      cancelled = true;
      if (avatarPollRef.current) {
        clearInterval(avatarPollRef.current);
        avatarPollRef.current = null;
      }
    };
  }, [selectedDebate?.id, selectedDebate?.status, voiceEnabled]);

  // ─── Load history ───
  // Production: surface API errors explicitly via `historyError` (with retry CTA).
  // Dev only: fall back to mock data so the UI is testable offline.
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await debateApi.getHistory(1, 20);
      setDebatesList(res.debates);
      setDevMockEnabled(false);
    } catch (err: unknown) {
      if (import.meta.env.DEV) {
        // Dev local — keep mock fallback so the UI remains testable offline.
        setDebatesList(MOCK_DEBATES_LIST);
        setDevMockEnabled(true);
        setHistoryError(null);
      } else {
        // Production — surface a real error state with retry. NEVER silently
        // swap to mock data; that masked real backend issues from users.
        setDebatesList([]);
        setDevMockEnabled(false);
        setHistoryError(
          getApiErrorMessage(
            err,
            "Impossible de charger l'historique des débats",
          ),
        );
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ─── Load selected debate when debateId changes ───
  const loadDebate = useCallback(
    async (id: string) => {
      // Dev-only mock fallback when API is unreachable (see loadHistory).
      if (devMockEnabled) {
        setSelectedDebate(MOCK_DEBATE);
        return;
      }

      setDebateLoading(true);
      setError(null);
      try {
        const result = await debateApi.getResult(Number(id));
        setSelectedDebate(result);

        // Start polling if still in progress
        const isInProgress =
          result.status !== "completed" && result.status !== "failed";
        if (isInProgress) {
          startPolling(Number(id));
        }
      } catch (err: unknown) {
        if (import.meta.env.DEV) {
          // Dev — fallback to mock so we can iterate offline
          setSelectedDebate(MOCK_DEBATE);
        } else {
          // Production — surface the real error, do NOT show fake mock data
          setSelectedDebate(null);
          setError(getApiErrorMessage(err, "Impossible de charger ce débat"));
        }
      } finally {
        setDebateLoading(false);
      }
    },
    [devMockEnabled],
  );

  useEffect(() => {
    if (debateId) {
      loadDebate(debateId);
    } else {
      setSelectedDebate(null);
      setPollError(null);
      stopPolling();
    }
  }, [debateId, loadDebate, stopPolling]);

  // ─── Polling for in-progress debates ───
  // On API error: retry up to POLL_MAX_RETRIES times with exponential backoff
  // (1s → 2s → 4s). After max retries, surface an explicit error message via
  // `pollError` instead of silently freezing the UI on the last known status.
  const startPolling = useCallback(
    (id: number) => {
      stopPolling();
      pollRetryCountRef.current = 0;
      setPollError(null);

      const tick = async () => {
        try {
          const statusRes = await debateApi.getStatus(id);
          // Reset retry counter on any successful tick
          pollRetryCountRef.current = 0;
          setPollError(null);

          if (
            statusRes.status === "completed" ||
            statusRes.status === "failed"
          ) {
            stopPolling();
            // Fetch the full result
            try {
              const result = await debateApi.getResult(id);
              setSelectedDebate(result);
              loadHistory(); // Refresh list
            } catch (err: unknown) {
              setError(
                getApiErrorMessage(
                  err,
                  "Impossible de charger le résultat du débat",
                ),
              );
            }
          } else {
            // Update status and video titles from polling response
            setSelectedDebate((prev) =>
              prev
                ? {
                    ...prev,
                    status: statusRes.status as DebateAnalysis["status"],
                    ...(statusRes.video_a_id && {
                      video_a_id: statusRes.video_a_id,
                    }),
                    ...(statusRes.video_b_id && {
                      video_b_id: statusRes.video_b_id,
                    }),
                    ...(statusRes.video_a_title && {
                      video_a_title: statusRes.video_a_title,
                    }),
                    ...(statusRes.video_b_title && {
                      video_b_title: statusRes.video_b_title,
                    }),
                    ...(statusRes.video_a_channel && {
                      video_a_channel: statusRes.video_a_channel,
                    }),
                    ...(statusRes.video_b_channel && {
                      video_b_channel: statusRes.video_b_channel,
                    }),
                    ...(statusRes.video_a_thumbnail && {
                      video_a_thumbnail: statusRes.video_a_thumbnail,
                    }),
                    ...(statusRes.video_b_thumbnail && {
                      video_b_thumbnail: statusRes.video_b_thumbnail,
                    }),
                  }
                : prev,
            );
          }
        } catch (err: unknown) {
          // Stop the running interval so we don't pile up requests on a flaky network
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          if (pollRetryCountRef.current >= POLL_MAX_RETRIES) {
            // Exhausted — surface an explicit error and give up
            setPollError(
              getApiErrorMessage(
                err,
                "Impossible de suivre la progression du débat",
              ),
            );
            return;
          }

          // Schedule a single retry tick with exponential backoff
          const backoffIdx = Math.min(
            pollRetryCountRef.current,
            POLL_RETRY_BACKOFF_MS.length - 1,
          );
          const delay = POLL_RETRY_BACKOFF_MS[backoffIdx];
          pollRetryCountRef.current += 1;

          if (pollRetryTimeoutRef.current) {
            clearTimeout(pollRetryTimeoutRef.current);
          }
          pollRetryTimeoutRef.current = setTimeout(() => {
            pollRetryTimeoutRef.current = null;
            // After backoff, run one tick. If it succeeds, resume the regular interval.
            tick().then(() => {
              if (
                !pollingRef.current &&
                pollRetryCountRef.current === 0 &&
                !pollError
              ) {
                pollingRef.current = setInterval(tick, POLL_INTERVAL_MS);
              }
            });
          }, delay);
        }
      };

      pollingRef.current = setInterval(tick, POLL_INTERVAL_MS);
    },
    [loadHistory, stopPolling, pollError],
  );

  // ─── Create debate ───
  const handleCreateDebate = async (data: {
    mode: "auto" | "manual";
    urlA: string;
    urlB?: string;
  }) => {
    setLoading(true);
    setError(null);

    // Dev-only: simulate a successful creation against MOCK data so we can
    // iterate offline. Production ALWAYS hits the real API.
    if (devMockEnabled && import.meta.env.DEV) {
      setTimeout(() => {
        setLoading(false);
        setSearchParams({ id: "1" });
      }, 2000);
      return;
    }

    try {
      const res = await debateApi.create({
        url_a: data.urlA,
        url_b: data.urlB,
        mode: data.mode,
        platform: "web",
      });
      setLoading(false);
      setSearchParams({ id: String(res.debate_id) });
    } catch (err: unknown) {
      setLoading(false);
      setError(getApiErrorMessage(err, "Erreur lors de la création du débat"));
    }
  };

  const handleSelectDebate = (id: number) => {
    setSearchParams({ id: String(id) });
  };

  const handleBack = () => {
    stopPolling();
    setPollError(null);
    setSelectedDebate(null);
    setSearchParams({});
  };

  // ─── Content margin class (responsive with sidebar) ───
  const mainClass = `transition-all duration-200 ease-out relative z-10 ${
    sidebarCollapsed ? "lg:ml-[60px]" : "lg:ml-[240px]"
  }`;

  // ─── Loading skeleton while debate is being fetched ───
  const renderSkeleton = () => (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={handleBack}
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux débats
      </button>
      <div className="animate-pulse space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-24 rounded-full bg-white/5" />
          <div className="h-8 w-96 max-w-full rounded-lg bg-white/5" />
        </div>
        <div className="h-40 rounded-xl bg-white/5" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-60 rounded-xl bg-white/5" />
          <div className="h-60 rounded-xl bg-white/5" />
        </div>
      </div>
    </div>
  );

  // ─── Detail view content ───
  const renderDetail = () => {
    if (!selectedDebate) return null;
    const isInProgress =
      selectedDebate.status !== "completed" &&
      selectedDebate.status !== "failed";
    const hasFactChecks =
      selectedDebate.fact_check_results &&
      selectedDebate.fact_check_results.length > 0;

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Back button */}
        <motion.button
          onClick={handleBack}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Retour aux débats
        </motion.button>
        {/* Topic header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-white/10 mb-3">
            <Swords className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-medium text-text-secondary">
              Débat IA
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight max-w-3xl mx-auto">
            {selectedDebate.detected_topic}
          </h1>
        </motion.div>
        {/* 🎙️ Hero CTA Agent Vocal */}
        {selectedDebate.status === "completed" && (
          <DebateVoiceHero
            avatarUrl={avatarData.url}
            avatarStatus={avatarData.status}
            debateTopic={selectedDebate.detected_topic}
            onOpen={() => setIsVoiceModalOpen(true)}
            voiceEnabled={voiceEnabled}
            avatarFallback="DB"
            onPrewarm={voiceChat.prewarm}
          />
        )}
        {/* Status tracker (if in progress) */}
        {isInProgress && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8"
          >
            <DebateStatusTracker status={selectedDebate.status} />
          </motion.div>
        )}
        {/* Poll error — surfaced when status polling fails after 3 retries */}
        {isInProgress && pollError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-xl"
          >
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-400">
                  Suivi de progression interrompu
                </p>
                <p className="text-xs text-amber-300/70 mt-1">{pollError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (selectedDebate) startPolling(selectedDebate.id);
              }}
              className="text-xs font-medium text-amber-300 hover:text-amber-200 underline underline-offset-2"
            >
              Reprendre le suivi
            </button>
          </motion.div>
        )}
        {/* Failed state */}
        {selectedDebate.status === "failed" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-red-400">
                Le débat a échoué
              </h3>
            </div>
            {selectedDebate.debate_summary && (
              <p className="text-sm text-red-300/70 leading-relaxed">
                {selectedDebate.debate_summary}
              </p>
            )}
          </motion.div>
        )}
        {/* VS Layout */}
        <div className="mb-4">
          <DebateVSLayout debate={selectedDebate} />
        </div>
        {/* Completed sections with doodle dividers */}
        {selectedDebate.status === "completed" && (
          <>
            {/* Doodle divider between VS and convergence/divergence */}
            <DoodleDivider variant="analysis" density="sparse" />

            {/* Convergence / Divergence */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-4"
            >
              <DebateConvergenceDivergence
                convergencePoints={selectedDebate.convergence_points}
                divergencePoints={selectedDebate.divergence_points}
              />
            </motion.div>

            {/* Fact Check (only if results exist) */}
            {hasFactChecks && (
              <>
                <DoodleDivider variant="analysis" density="sparse" />

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mb-4"
                >
                  <DebateFactCheck
                    results={selectedDebate.fact_check_results}
                  />
                </motion.div>
              </>
            )}

            {/* Doodle divider before summary */}
            <DoodleDivider variant="analysis" density="sparse" />

            {/* Summary */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 mb-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-indigo-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  Synthèse du débat
                </h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                {selectedDebate.debate_summary}
              </p>
            </motion.div>

            {/* Doodle divider before chat */}
            <DoodleDivider variant="analysis" density="sparse" />

            {/* Chat */}
            <DebateChat
              debateId={selectedDebate.id}
              debateTopic={selectedDebate.detected_topic ?? undefined}
            />
          </>
        )}
      </div>
    );
  };

  // ─── List / Create view content ───
  const renderList = () => (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Page header with doodle accent */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-white/10 mb-3">
          <Swords className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-medium text-text-secondary">
            Débat IA
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
          Confrontez les points de vue
        </h1>
        <p className="text-sm text-text-muted max-w-md mx-auto">
          Analysez deux vidéos qui défendent des positions opposées. DeepSight
          compare les arguments, identifie les convergences et vérifie les
          faits.
        </p>
      </motion.div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 backdrop-blur-xl"
        >
          {error}
        </motion.div>
      )}

      {/* Create form */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-4"
      >
        <DebateCreateForm onSubmit={handleCreateDebate} loading={loading} />
      </motion.div>

      {/* Doodle divider between form and history */}
      <DoodleDivider variant="analysis" density="sparse" />

      {/* Past debates */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-text-tertiary" />
          <h2 className="text-sm font-semibold text-text-secondary">
            Débats récents
          </h2>
        </div>
        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <DeepSightSpinnerSmall />
          </div>
        ) : historyError ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-xl"
          >
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">
                  Impossible de charger l'historique des débats
                </p>
                <p className="text-xs text-red-300/70 mt-1">{historyError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadHistory}
              className="text-xs font-medium text-red-300 hover:text-red-200 underline underline-offset-2"
            >
              Réessayer
            </button>
          </motion.div>
        ) : debatesList.length > 0 ? (
          <div className="space-y-2">
            {debatesList.map((debate) => (
              <DebateSummaryCard
                key={debate.id}
                debate={debate}
                onClick={handleSelectDebate}
              />
            ))}
          </div>
        ) : (
          <DoodleEmptyState type="no-analyses">
            <p className="text-sm font-medium text-text-muted mb-1">
              Aucun débat pour le moment
            </p>
            <p className="text-xs text-text-tertiary">
              Lancez votre premier débat IA ci-dessus !
            </p>
          </DoodleEmptyState>
        )}
      </motion.div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER — Unified layout with DoodleBackground + Sidebar
  // ═══════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-bg-primary relative text-white">
      {/* Doodle background */}
      <ErrorBoundary fallback={null}>
        <DoodleBackground variant="analysis" />
      </ErrorBoundary>

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main content with sidebar-responsive margin */}
      <main className={mainClass}>
        {debateLoading && !selectedDebate && debateId
          ? renderSkeleton()
          : selectedDebate
            ? renderDetail()
            : renderList()}
      </main>

      {/* 🎙️ Voice chat — Debate moderator agent.
          Shown only when a debate is selected, analysis is completed,
          and the voice feature is available (plan gating). */}
      {selectedDebate && selectedDebate.status === "completed" && (
        <>
          <VoiceModal
            isOpen={isVoiceModalOpen}
            onClose={() => {
              setIsVoiceModalOpen(false);
              voiceChat.stop();
            }}
            videoTitle={selectedDebate.detected_topic || "Débat IA"}
            channelName={
              selectedDebate.video_a_channel && selectedDebate.video_b_channel
                ? `${selectedDebate.video_a_channel} vs ${selectedDebate.video_b_channel}`
                : "Modérateur de débat"
            }
            voiceStatus={voiceChat.status}
            isSpeaking={voiceChat.isSpeaking}
            messages={voiceChat.messages}
            elapsedSeconds={voiceChat.elapsedSeconds}
            remainingMinutes={voiceChat.remainingMinutes}
            onStart={voiceChat.start}
            onStop={voiceChat.stop}
            onMuteToggle={voiceChat.toggleMute}
            isMuted={voiceChat.isMuted}
            inputMode={voiceChat.inputMode}
            pttKey={voiceChat.pttKey}
            isTalking={voiceChat.isTalking}
            onStartTalking={voiceChat.startTalking}
            onStopTalking={voiceChat.stopTalking}
            activeTool={voiceChat.activeTool}
            error={voiceChat.error ?? undefined}
            playbackRate={voiceChat.playbackRate}
            avatarUrl={avatarData.url}
            avatarStatus={avatarData.status}
            avatarFallback="DB"
            micLevel={micLevel}
          />
        </>
      )}
    </div>
  );
};

export default DebatePage;
