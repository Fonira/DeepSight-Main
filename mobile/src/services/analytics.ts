/**
 * Analytics Service — Tracking léger pour DeepSight Mobile
 *
 * Collecte locale des événements + batch upload vers le backend.
 * Zéro dépendance externe. RGPD / CNIL : OPT-IN strict — aucun événement
 * collecté ni identifiant de session stocké tant que l'utilisateur n'a pas
 * activé « Statistiques d'usage » dans son profil (analytics.optIn()).
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
import {
  Platform,
  AppState,
  type AppStateStatus,
  type NativeEventSubscription,
} from "react-native";
import { API_BASE_URL } from "../constants/config";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type AnalyticsEventName =
  | "app_opened"
  | "app_backgrounded"
  | "screen_viewed"
  | "analysis_started"
  | "analysis_completed"
  | "analysis_failed"
  | "analysis_deleted"
  | "chat_message_sent"
  | "tab_switched"
  | "share_intent_received"
  | "upgrade_cta_viewed"
  | "upgrade_cta_clicked"
  | "upgrade_plan_selected"
  | "upgrade_checkout_started"
  | "search_performed"
  | "flashcard_generated"
  | "quiz_generated"
  | "study_content_generated"
  | "mindmap_generated"
  | "factcheck_requested"
  | "export_requested"
  | "favorite_toggled"
  | "video_deleted"
  | "notification_received"
  | "notification_tapped"
  | "share_link_created"
  | "login"
  | "register"
  | "logout";

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
/** "true" uniquement après accord explicite. Absent ou "false" = aucun tracking. */
const CONSENT_KEY = "deepsight_analytics_consent";
/** Ancienne clé opt-out (avant relance 2026) — purgée, ne vaut jamais consentement. */
const LEGACY_OPT_OUT_KEY = "deepsight_analytics_opt_out";
const SESSION_ID_KEY = "deepsight_analytics_session";
const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 60_000; // 1 minute
const MAX_QUEUE_SIZE = 200;

// ─────────────────────────────────────────────────────────
// Analytics Engine
// ─────────────────────────────────────────────────────────

class AnalyticsEngine {
  private queue: AnalyticsEvent[] = [];
  private sessionId: string = "";
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: NativeEventSubscription | null = null;
  private config: AnalyticsConfig = {
    enabled: false,
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
      await AsyncStorage.removeItem(LEGACY_OPT_OUT_KEY);

      // RGPD : opt-in strict. Sans accord, on purge et on ne démarre rien.
      if (!(await this.hasConsent())) {
        this.config.enabled = false;
        await this.purgeLocalData();
        this.isInitialized = true;
        return;
      }

      await this.start();
      this.isInitialized = true;
    } catch (error) {
      if (__DEV__) console.warn("[Analytics] Init failed:", error);
    }
  }

  /**
   * Démarre la collecte (uniquement après consentement).
   */
  private async start(): Promise<void> {
    this.config.enabled = true;

    // Générer ou récupérer session ID
    this.sessionId = await this.getOrCreateSessionId();

    // Récupérer la queue persistée
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AnalyticsEvent[];
        this.queue = parsed.slice(-MAX_QUEUE_SIZE);
      } catch {
        this.queue = [];
      }
    }

    // Démarrer le flush périodique
    this.startFlushTimer();

    // Écouter les changements d'état de l'app
    this.appStateSubscription?.remove();
    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange,
    );

    this.log("Analytics started", { sessionId: this.sessionId });
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

    const events = [...this.queue];
    this.queue = [];

    try {
      // Envoyer au backend (fire-and-forget, ne bloque pas l'UX)
      const response = await fetch(`${API_BASE_URL}/api/analytics/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events, platform: "mobile" }),
      });

      if (!response.ok) {
        // Remettre les événements dans la queue si erreur serveur
        this.queue = [...events, ...this.queue].slice(-MAX_QUEUE_SIZE);
      } else {
        this.log(`Flushed ${events.length} events`);
      }
    } catch {
      // Offline — remettre dans la queue
      this.queue = [...events, ...this.queue].slice(-MAX_QUEUE_SIZE);
    }

    await this.persistQueue();
  }

  /**
   * Retrait du consentement (RGPD) : arrêt immédiat + purge locale.
   */
  async optOut(): Promise<void> {
    this.config.enabled = false;
    this.stopFlushTimer();
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
    await AsyncStorage.setItem(CONSENT_KEY, "false");
    await this.purgeLocalData();
    this.log("User opted out of analytics");
  }

  /**
   * Consentement explicite (interrupteur « Statistiques d'usage »).
   */
  async optIn(): Promise<void> {
    await AsyncStorage.setItem(CONSENT_KEY, "true");
    await this.start();
    this.isInitialized = true;
    this.log("User opted in to analytics");
  }

  /**
   * true uniquement si l'utilisateur a explicitement accepté.
   */
  async hasConsent(): Promise<boolean> {
    return (await AsyncStorage.getItem(CONSENT_KEY)) === "true";
  }

  /**
   * @deprecated Utiliser hasConsent(). Conservé pour compatibilité.
   */
  async isOptedOut(): Promise<boolean> {
    return !(await this.hasConsent());
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

  private async purgeLocalData(): Promise<void> {
    this.queue = [];
    this.sessionId = "";
    await AsyncStorage.multiRemove([STORAGE_KEY, SESSION_ID_KEY]);
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
