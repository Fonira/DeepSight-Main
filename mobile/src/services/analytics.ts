/**
 * Analytics Service — Tracking léger pour DeepSight Mobile
 *
 * Collecte locale des événements + batch upload vers le backend.
 * Zéro dépendance externe, respecte RGPD (opt-out possible).
 *
 * Événements trackés :
 * - analysis_started / analysis_completed / analysis_failed / analysis_deleted
 * - chat_message_sent
 * - tab_switched (summary/chat/concepts/tools)
 * - share_intent_received (youtube/tiktok)
 * - upgrade_cta_viewed / upgrade_cta_clicked / upgrade_plan_selected / upgrade_checkout_started
 * - screen_viewed
 * - app_opened / app_backgrounded
 * - search_performed
 * - flashcard_generated / quiz_generated / study_content_generated
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, AppState, type AppStateStatus } from "react-native";
import { API_BASE_URL } from "../constants/config";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

/**
 * Miroir de la liste autorisée par POST /api/analytics/events
 * (backend/src/analytics/router.py, EventPayload.validate_name).
 * Un seul nom inconnu fait rejeter tout le lot en 422 : ne rien envoyer d'autre.
 */
export const ANALYTICS_EVENT_NAMES = [
  "app_opened",
  "app_backgrounded",
  "screen_viewed",
  "analysis_started",
  "analysis_completed",
  "analysis_failed",
  "analysis_deleted",
  "chat_message_sent",
  "tab_switched",
  "share_intent_received",
  "upgrade_cta_viewed",
  "upgrade_cta_clicked",
  "upgrade_plan_selected",
  "upgrade_checkout_started",
  "search_performed",
  "flashcard_generated",
  "quiz_generated",
  "study_content_generated",
  "mindmap_generated",
  "factcheck_requested",
  "export_requested",
  "favorite_toggled",
  "video_deleted",
  "notification_received",
  "notification_tapped",
  "share_link_created",
  "login",
  "register",
  "logout",
  "payment_cancel_reason",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

const ALLOWED_EVENT_NAMES: ReadonlySet<string> = new Set(ANALYTICS_EVENT_NAMES);

export function isAllowedAnalyticsEvent(
  name: string,
): name is AnalyticsEventName {
  return ALLOWED_EVENT_NAMES.has(name);
}

/** Limite du backend : EventBatch.limit_batch (max 100 événements par requête). */
export const MAX_EVENTS_PER_REQUEST = 100;

export function chunkEvents<T>(
  events: ReadonlyArray<T>,
  size: number = MAX_EVENTS_PER_REQUEST,
): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < events.length; i += size) {
    chunks.push(events.slice(i, i + size));
  }
  return chunks;
}

/**
 * Un lot refusé pour une raison définitive (4xx hors 408/429) est abandonné :
 * le remettre en file le renverrait en échec indéfiniment.
 */
export function shouldRequeueAfterStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  return status < 400 || status >= 500;
}

interface AnalyticsEvent {
  name: AnalyticsEventName;
  properties?: Record<string, string | number | boolean | null>;
  timestamp: string;
  session_id: string;
}

interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
  batchSize: number;
  flushIntervalMs: number;
}

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const STORAGE_KEY = "deepsight_analytics_queue";
const OPT_OUT_KEY = "deepsight_analytics_opt_out";
const SESSION_ID_KEY = "deepsight_analytics_session";
const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 60_000; // 1 minute
const MAX_QUEUE_SIZE = 200;

// ─────────────────────────────────────────────────────────
// Analytics Engine
// ─────────────────────────────────────────────────────────

export class AnalyticsEngine {
  private queue: AnalyticsEvent[] = [];
  private sessionId: string = "";
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private config: AnalyticsConfig = {
    enabled: true,
    debug: __DEV__,
    batchSize: BATCH_SIZE,
    flushIntervalMs: FLUSH_INTERVAL_MS,
  };
  private userId: string | null = null;
  private userPlan: string | null = null;
  private isInitialized = false;

  /**
   * Initialise le moteur d'analytics
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Vérifier opt-out
      const optOut = await AsyncStorage.getItem(OPT_OUT_KEY);
      if (optOut === "true") {
        this.config.enabled = false;
        this.isInitialized = true;
        return;
      }

      // Générer ou récupérer session ID
      this.sessionId = await this.getOrCreateSessionId();

      // Récupérer la queue persistée
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as AnalyticsEvent[];
          // Une file persistée par une ancienne version peut contenir des noms refusés
          this.queue = parsed
            .filter((event) => isAllowedAnalyticsEvent(event.name))
            .slice(-MAX_QUEUE_SIZE);
        } catch {
          this.queue = [];
        }
      }

      // Démarrer le flush périodique
      this.startFlushTimer();

      // Écouter les changements d'état de l'app
      AppState.addEventListener("change", this.handleAppStateChange);

      this.isInitialized = true;
      this.log("Analytics initialized", { sessionId: this.sessionId });
    } catch (error) {
      if (__DEV__) console.warn("[Analytics] Init failed:", error);
    }
  }

  /**
   * Identifie l'utilisateur (après login)
   */
  identify(userId: string, plan?: string): void {
    this.userId = userId;
    this.userPlan = plan || null;
    this.log("User identified", { userId, plan });
  }

  /**
   * Reset l'identité (après logout)
   */
  reset(): void {
    this.userId = null;
    this.userPlan = null;
    this.sessionId = this.generateSessionId();
    this.log("User reset");
  }

  /**
   * Track un événement
   */
  track(
    name: AnalyticsEventName,
    properties?: Record<string, string | number | boolean | null>,
  ): void {
    if (!this.config.enabled) return;
    // Garde d'exécution : un nom hors liste ferait rejeter tout le lot (422)
    if (!isAllowedAnalyticsEvent(name)) {
      this.log(`Event ignored (not allowed by the backend): ${name}`);
      return;
    }

    const event: AnalyticsEvent = {
      name,
      properties: {
        ...properties,
        platform: Platform.OS,
        user_id: this.userId,
        user_plan: this.userPlan,
      },
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
    };

    this.queue.push(event);
    this.log(`Event: ${name}`, properties);

    // Flush si la queue est pleine
    if (this.queue.length >= this.config.batchSize) {
      this.flush().catch(() => {});
    }

    // Persister la queue
    this.persistQueue().catch(() => {});
  }

  /**
   * Track un écran vu
   */
  screen(
    screenName: string,
    properties?: Record<string, string | number | boolean | null>,
  ): void {
    this.track("screen_viewed", { screen: screenName, ...properties });
  }

  /**
   * Envoie les événements au backend
   */
  async flush(): Promise<void> {
    if (!this.config.enabled || this.queue.length === 0) return;

    const events = this.queue.filter((event) =>
      isAllowedAnalyticsEvent(event.name),
    );
    this.queue = [];

    // Lots de 100 max (limite backend), envoyés dans l'ordre
    const chunks = chunkEvents(events);
    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      try {
        // Envoyer au backend (fire-and-forget, ne bloque pas l'UX)
        const response = await fetch(`${API_BASE_URL}/api/analytics/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: chunk, platform: "mobile" }),
        });

        if (response.ok) {
          this.log(`Flushed ${chunk.length} events`);
          continue;
        }
        if (!shouldRequeueAfterStatus(response.status)) {
          // Lot invalide (ex. 422) : abandonné pour ne pas bloquer la file
          this.log(`Dropped ${chunk.length} events (HTTP ${response.status})`);
          continue;
        }
      } catch {
        // Offline — on remet ce lot et les suivants dans la queue
      }
      // Erreur serveur/limite/réseau : remettre ce lot et les suivants, réessayer plus tard
      const pending = chunks.slice(index).flat();
      this.queue = [...pending, ...this.queue].slice(-MAX_QUEUE_SIZE);
      break;
    }

    await this.persistQueue();
  }

  /**
   * Opt-out complet (RGPD)
   */
  async optOut(): Promise<void> {
    this.config.enabled = false;
    this.queue = [];
    await AsyncStorage.setItem(OPT_OUT_KEY, "true");
    await AsyncStorage.removeItem(STORAGE_KEY);
    this.stopFlushTimer();
    this.log("User opted out of analytics");
  }

  /**
   * Opt-in (réactiver)
   */
  async optIn(): Promise<void> {
    this.config.enabled = true;
    await AsyncStorage.setItem(OPT_OUT_KEY, "false");
    this.startFlushTimer();
    this.log("User opted in to analytics");
  }

  /**
   * Vérifie si l'utilisateur a opt-out
   */
  async isOptedOut(): Promise<boolean> {
    const value = await AsyncStorage.getItem(OPT_OUT_KEY);
    return value === "true";
  }

  // ─── Private Methods ────────────────────────────────────

  private handleAppStateChange = (state: AppStateStatus): void => {
    if (state === "active") {
      this.track("app_opened");
    } else if (state === "background") {
      this.track("app_backgrounded");
      this.flush().catch(() => {});
    }
  };

  private async getOrCreateSessionId(): Promise<string> {
    try {
      const stored = await AsyncStorage.getItem(SESSION_ID_KEY);
      if (stored) {
        const { id, timestamp } = JSON.parse(stored);
        // Session expire après 30 minutes d'inactivité
        const age = Date.now() - new Date(timestamp).getTime();
        if (age < 30 * 60 * 1000) return id;
      }
    } catch {
      // ignore
    }
    const newId = this.generateSessionId();
    await AsyncStorage.setItem(
      SESSION_ID_KEY,
      JSON.stringify({ id: newId, timestamp: new Date().toISOString() }),
    );
    return newId;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private async persistQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.queue.slice(-MAX_QUEUE_SIZE)),
      );
    } catch {
      // Storage full or unavailable
    }
  }

  private startFlushTimer(): void {
    this.stopFlushTimer();
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {});
    }, this.config.flushIntervalMs);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private log(message: string, data?: unknown): void {
    if (this.config.debug && __DEV__) {
      console.log(`📊 [Analytics] ${message}`, data || "");
    }
  }
}

// ─────────────────────────────────────────────────────────
// Singleton export
// ─────────────────────────────────────────────────────────

export const analytics = new AnalyticsEngine();

// ─────────────────────────────────────────────────────────
// Helpers raccourcis
// ─────────────────────────────────────────────────────────

export const trackEvent = analytics.track.bind(analytics);
export const trackScreen = analytics.screen.bind(analytics);
