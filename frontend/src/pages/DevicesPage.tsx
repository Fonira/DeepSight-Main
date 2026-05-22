/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  DEEP SIGHT — Devices Page (Auth V2 Wave 1 Step 2)                            ║
 * ║  Liste des sessions actives + révocation (individuelle ou toutes les autres). ║
 * ║  Consomme :                                                                   ║
 * ║    GET    /api/auth/sessions                                                  ║
 * ║    DELETE /api/auth/sessions/{id}                                             ║
 * ║    DELETE /api/auth/sessions                                                  ║
 * ║  (Backend PR #533 — Wave 1 V2 multi-device sessions)                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { authApi } from "../services/api";
import { Sidebar } from "../components/layout/Sidebar";
import { useToast } from "../components/Toast";
import { SEO } from "../components/SEO";
import DoodleBackground from "../components/DoodleBackground";
import {
  Smartphone,
  Monitor,
  Globe,
  Trash2,
  ShieldOff,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { UserSession } from "../types/auth";

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format ISO timestamp → "il y a X temps" (fr) ou "X ago" (en).
 * Gardé volontairement simple, pas de dépendance dayjs/date-fns ici pour
 * limiter la surface du sprint Step 2.
 */
function formatRelativeTime(iso: string, lang: "fr" | "en"): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const seconds = Math.max(
      0,
      Math.floor((Date.now() - date.getTime()) / 1000),
    );
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (lang === "fr") {
      if (seconds < 60) return "à l'instant";
      if (minutes < 60) return `il y a ${minutes} min`;
      if (hours < 24) return `il y a ${hours} h`;
      if (days < 30) return `il y a ${days} j`;
      return date.toLocaleDateString("fr-FR");
    }
    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString("en-US");
  } catch {
    return iso;
  }
}

/**
 * Tronque ip_hash pour l'affichage (les 12 premiers chars suffisent
 * pour distinguer deux sessions différentes).
 */
function shortHash(value?: string | null): string {
  if (!value) return "—";
  return value.length > 12 ? `${value.slice(0, 12)}…` : value;
}

/**
 * Choisit une icône d'appareil depuis le device_label / user_agent.
 */
function pickDeviceIcon(session: UserSession) {
  const haystack = `${session.device_label || ""} ${session.user_agent || ""}`
    .toLowerCase();
  if (/iphone|android|mobile|ipad|tablet/.test(haystack)) return Smartphone;
  if (/chrome|firefox|safari|edge|windows|mac|linux/.test(haystack)) {
    return Monitor;
  }
  return Globe;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 Component
// ═══════════════════════════════════════════════════════════════════════════════

const DevicesPage: React.FC = () => {
  const { language } = useTranslation();
  const { showToast, ToastComponent } = useToast();
  const tr = useCallback(
    (fr: string, en: string) => (language === "fr" ? fr : en),
    [language],
  );

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // 📡 Fetch
  // ───────────────────────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    try {
      setError(null);
      const list = await authApi.listSessions();
      setSessions(list);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : tr("Erreur de chargement", "Loading error");
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // ───────────────────────────────────────────────────────────────────────────
  // 🗑️ Actions
  // ───────────────────────────────────────────────────────────────────────────

  const handleRevokeOne = useCallback(
    async (session: UserSession) => {
      const label = session.device_label || tr("cet appareil", "this device");
      const confirmMsg = tr(
        `Révoquer la session sur "${label}" ? L'appareil devra se reconnecter.`,
        `Revoke the session on "${label}"? The device will need to sign in again.`,
      );
      if (!window.confirm(confirmMsg)) return;

      setRevokingId(session.id);
      try {
        const res = await authApi.revokeSession(session.id);
        showToast(
          res.message || tr("Session révoquée", "Session revoked"),
          "success",
        );
        await fetchSessions();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : tr("Échec de la révocation", "Revocation failed");
        showToast(message, "error");
      } finally {
        setRevokingId(null);
      }
    },
    [fetchSessions, showToast, tr],
  );

  const handleRevokeAll = useCallback(async () => {
    const confirmMsg = tr(
      "Déconnecter TOUS les autres appareils ? Ta session courante restera active.",
      "Sign out ALL other devices? Your current session will stay active.",
    );
    if (!window.confirm(confirmMsg)) return;

    setRevokingAll(true);
    try {
      const res = await authApi.revokeAllOtherSessions();
      showToast(
        res.message ||
          tr("Sessions révoquées", "Other sessions revoked"),
        "success",
      );
      await fetchSessions();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : tr("Échec de la révocation", "Revocation failed");
      showToast(message, "error");
    } finally {
      setRevokingAll(false);
    }
  }, [fetchSessions, showToast, tr]);

  // ───────────────────────────────────────────────────────────────────────────
  // 🖼️ Render
  // ───────────────────────────────────────────────────────────────────────────

  const otherSessionsCount = sessions.filter((s) => !s.current).length;

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <SEO title={tr("Mes appareils", "My devices")} path="/settings/devices" />
      <DoodleBackground variant="tech" />

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main
        id="main-content"
        className={`transition-all duration-200 ease-out relative z-10 ${
          sidebarCollapsed ? "lg:ml-[60px]" : "lg:ml-[240px]"
        }`}
      >
        <div className="min-h-screen pt-16 lg:pt-0 p-3 sm:p-6 lg:p-8 pb-8">
          <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
            {/* Header */}
            <header className="mb-6 sm:mb-8 ml-12 sm:ml-0 lg:ml-0">
              <h1 className="text-lg sm:text-2xl font-semibold mb-2 flex items-center gap-2 sm:gap-3 text-text-primary">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                </div>
                <span className="truncate">
                  {tr("Mes appareils", "My devices")}
                </span>
              </h1>
              <p className="text-text-secondary text-xs sm:text-sm sm:ml-[52px]">
                {tr(
                  "Liste des appareils actuellement connectés à ton compte. Tu peux révoquer une session si tu ne la reconnais pas.",
                  "Devices currently signed into your account. Revoke a session if you don't recognize it.",
                )}
              </p>
            </header>

            {/* Action globale — visible seulement si >1 session */}
            {!loading && otherSessionsCount > 0 && (
              <section className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
                  <div className="flex items-start gap-3">
                    <ShieldOff className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-text-primary text-sm">
                        {tr(
                          `${otherSessionsCount} autre${otherSessionsCount > 1 ? "s" : ""} session${otherSessionsCount > 1 ? "s" : ""} active${otherSessionsCount > 1 ? "s" : ""}`,
                          `${otherSessionsCount} other active session${otherSessionsCount > 1 ? "s" : ""}`,
                        )}
                      </p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {tr(
                          "Si tu suspectes une connexion non autorisée, déconnecte tout maintenant.",
                          "If you suspect unauthorized access, sign everything out now.",
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRevokeAll}
                    disabled={revokingAll}
                    aria-label={tr(
                      "Déconnecter tous les autres appareils",
                      "Sign out all other devices",
                    )}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {revokingAll ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldOff className="w-4 h-4" />
                    )}
                    {tr(
                      "Déconnecter tous les autres",
                      "Sign out all others",
                    )}
                  </button>
                </div>
              </section>
            )}

            {/* Liste sessions */}
            <section
              aria-label={tr("Sessions actives", "Active sessions")}
              className="space-y-3"
            >
              {loading && (
                <div
                  className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6 flex items-center justify-center gap-2 text-text-secondary text-sm"
                  role="status"
                  aria-live="polite"
                >
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {tr("Chargement…", "Loading…")}
                </div>
              )}

              {!loading && error && (
                <div
                  className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3"
                  role="alert"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-300 text-sm">
                      {tr("Erreur", "Error")}
                    </p>
                    <p className="text-xs text-red-300/80 mt-1">{error}</p>
                    <button
                      onClick={() => {
                        setLoading(true);
                        fetchSessions();
                      }}
                      className="mt-3 inline-flex items-center gap-2 text-xs text-red-200 hover:text-white underline"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {tr("Réessayer", "Retry")}
                    </button>
                  </div>
                </div>
              )}

              {!loading && !error && sessions.length === 0 && (
                <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6 text-center text-sm text-text-secondary">
                  {tr(
                    "Aucune session active trouvée.",
                    "No active session found.",
                  )}
                </div>
              )}

              {!loading &&
                !error &&
                sessions.map((session) => {
                  const Icon = pickDeviceIcon(session);
                  const isCurrent = session.current;
                  const isRevoking = revokingId === session.id;
                  return (
                    <article
                      key={session.id}
                      data-testid={`session-card-${session.id}`}
                      className={`rounded-2xl backdrop-blur-xl bg-white/5 border p-4 sm:p-5 transition-colors ${
                        isCurrent
                          ? "border-indigo-500/40 ring-1 ring-indigo-500/20"
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isCurrent
                              ? "bg-indigo-500/15 text-indigo-300"
                              : "bg-white/5 text-text-secondary"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-text-primary text-sm truncate">
                              {session.device_label ||
                                tr("Appareil inconnu", "Unknown device")}
                            </p>
                            {isCurrent && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 text-[10px] font-medium uppercase tracking-wide"
                                aria-label={tr(
                                  "Cette session",
                                  "Current session",
                                )}
                              >
                                {tr("Cette session", "Current session")}
                              </span>
                            )}
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary">
                            <span
                              className="inline-flex items-center gap-1"
                              title={session.last_seen_at}
                            >
                              <Clock className="w-3 h-3" />
                              {tr("Vu", "Seen")}{" "}
                              {formatRelativeTime(
                                session.last_seen_at,
                                language as "fr" | "en",
                              )}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Globe className="w-3 h-3" />
                              {shortHash(session.ip_hash)}
                            </span>
                          </div>

                          {session.user_agent && (
                            <p className="mt-1.5 text-[11px] text-text-tertiary/70 truncate font-mono">
                              {session.user_agent}
                            </p>
                          )}
                        </div>

                        {!isCurrent && (
                          <button
                            onClick={() => handleRevokeOne(session)}
                            disabled={isRevoking}
                            aria-label={tr(
                              "Révoquer cette session",
                              "Revoke this session",
                            )}
                            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isRevoking ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">
                              {tr("Révoquer", "Revoke")}
                            </span>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
            </section>
          </div>
        </div>
      </main>

      {ToastComponent}
    </div>
  );
};

export default DevicesPage;
