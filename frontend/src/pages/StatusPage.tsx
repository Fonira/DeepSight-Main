/**
 * Page de statut interne — accessible aux utilisateurs connectés.
 * Appelle le proxy Vercel /api/status (deep health check) toutes les 60s.
 * Fallback public /api/health/status si le proxy échoue.
 *
 * Section "Live status (Instatus)" en bas : fetch le summary.json public
 * de la status page externe https://status.deepsightsynthesis.com et
 * affiche les composants en cards cohérentes avec le design DeepSight.
 * Fallback gracieux si Instatus pas encore configuré.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Database,
  CreditCard,
  Brain,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Activity,
  Mail,
  HardDrive,
  Cpu,
  ExternalLink,
  Globe,
} from "lucide-react";
import {
  statusApi,
  type DeepSystemStatus,
  type ServiceStatus,
} from "../services/api";
import { SEO } from "../components/SEO";
import DoodleBackground from "../components/DoodleBackground";

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 60; // seconds

// ───────────────────────────────────────────────────────────────────────────
// Instatus public summary endpoint (no auth required, served by status page
// custom domain). Format documenté : https://instatus.com/help/api
// ───────────────────────────────────────────────────────────────────────────

const INSTATUS_SUMMARY_URL =
  "https://status.deepsightsynthesis.com/summary.json";
const INSTATUS_PUBLIC_URL = "https://status.deepsightsynthesis.com";

type InstatusComponentStatus =
  | "OPERATIONAL"
  | "UNDERMAINTENANCE"
  | "DEGRADEDPERFORMANCE"
  | "PARTIALOUTAGE"
  | "MAJOROUTAGE";

type InstatusPageStatus =
  | "UP"
  | "HASISSUES"
  | "UNDERMAINTENANCE"
  | "DOWN";

interface InstatusComponent {
  id: string;
  name: string;
  status: InstatusComponentStatus;
  showcase?: boolean;
  group?: { id: string; name: string } | null;
}

interface InstatusSummary {
  page: { name: string; url: string; status: InstatusPageStatus };
  activeIncidents: ReadonlyArray<{ id: string; name: string; status: string }>;
  components: ReadonlyArray<InstatusComponent>;
  activeMaintenances: ReadonlyArray<{ id: string; name: string }>;
}

function instatusStatusColor(status: InstatusComponentStatus): string {
  switch (status) {
    case "OPERATIONAL":
      return "var(--status-success, #10b981)";
    case "UNDERMAINTENANCE":
    case "DEGRADEDPERFORMANCE":
      return "var(--status-warning, #f59e0b)";
    case "PARTIALOUTAGE":
    case "MAJOROUTAGE":
    default:
      return "var(--status-error, #ef4444)";
  }
}

function instatusStatusLabel(status: InstatusComponentStatus): string {
  switch (status) {
    case "OPERATIONAL":
      return "Opérationnel";
    case "UNDERMAINTENANCE":
      return "En maintenance";
    case "DEGRADEDPERFORMANCE":
      return "Performances dégradées";
    case "PARTIALOUTAGE":
      return "Panne partielle";
    case "MAJOROUTAGE":
      return "Panne majeure";
    default:
      return "Inconnu";
  }
}

function instatusPageLabel(status: InstatusPageStatus): string {
  switch (status) {
    case "UP":
      return "Tous les services sont opérationnels";
    case "HASISSUES":
      return "Incident en cours";
    case "UNDERMAINTENANCE":
      return "Maintenance planifiée";
    case "DOWN":
      return "Service indisponible";
    default:
      return "Statut inconnu";
  }
}

const SERVICE_META: Record<
  string,
  { icon: typeof Database; label: string; description: string }
> = {
  database: {
    icon: Database,
    label: "Base de données",
    description: "PostgreSQL — stockage principal",
  },
  redis: {
    icon: HardDrive,
    label: "Redis",
    description: "Cache et sessions",
  },
  stripe: {
    icon: CreditCard,
    label: "Stripe",
    description: "Traitement des paiements",
  },
  mistral: {
    icon: Brain,
    label: "Mistral AI",
    description: "Analyse et chat IA",
  },
  perplexity: {
    icon: Search,
    label: "Perplexity AI",
    description: "Fact-checking et recherche web",
  },
  resend: {
    icon: Mail,
    label: "Resend",
    description: "Service d'envoi d'emails",
  },
};

function statusColor(status: string) {
  if (status === "operational") return "var(--status-success, #10b981)";
  if (status === "degraded") return "var(--status-warning, #f59e0b)";
  return "var(--status-error, #ef4444)";
}

function StatusDot({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <span className="relative flex h-3 w-3" aria-label={status}>
      {status !== "operational" && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
          style={{ backgroundColor: color }}
        />
      )}
      <span
        className="relative inline-flex h-3 w-3 rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "operational")
    return <CheckCircle2 size={18} style={{ color: statusColor(status) }} />;
  if (status === "degraded")
    return <AlertTriangle size={18} style={{ color: statusColor(status) }} />;
  return <XCircle size={18} style={{ color: statusColor(status) }} />;
}

function formatUptime(seconds: number | null): string {
  if (seconds == null) return "\u2014";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}j`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function formatLatency(ms: number | null): string {
  if (ms == null) return "\u2014";
  return `${ms.toFixed(0)} ms`;
}

function statusLabel(status: string): string {
  if (status === "operational") return "Op\u00e9rationnel";
  if (status === "degraded") return "D\u00e9grad\u00e9";
  return "Hors service";
}

// ───────────────────────────────────────────────────────────────────────────
// Instatus section — fetch public summary.json + render in DeepSight design
// ───────────────────────────────────────────────────────────────────────────

function InstatusSection() {
  const [summary, setSummary] = useState<InstatusSummary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    (async () => {
      try {
        const resp = await fetch(INSTATUS_SUMMARY_URL, {
          signal: controller.signal,
          // No credentials — public endpoint
          mode: "cors",
        });
        if (!resp.ok) {
          if (!cancelled) setState("unavailable");
          return;
        }
        const json = (await resp.json()) as InstatusSummary;
        if (cancelled) return;
        // Sanity check : si la forme attendue n'est pas là, fallback gracieux
        if (!json || typeof json !== "object" || !Array.isArray(json.components)) {
          setState("unavailable");
          return;
        }
        setSummary(json);
        setState("ready");
      } catch {
        if (!cancelled) setState("unavailable");
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  // Header commun à tous les états (loading/ready/unavailable)
  const header = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Globe size={18} style={{ color: "var(--accent-primary, #6366f1)" }} />
        <h2 className="text-lg font-semibold">Statut public (Instatus)</h2>
      </div>
      <a
        href={INSTATUS_PUBLIC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary,#6b6b80)] hover:text-[var(--accent-primary,#6366f1)] transition-colors"
      >
        Page complète
        <ExternalLink size={12} />
      </a>
    </div>
  );

  if (state === "loading") {
    return (
      <section aria-label="Statut Instatus" className="space-y-2">
        {header}
        <div className="rounded-xl p-5 border border-[var(--border-subtle,#ffffff0d)] bg-[var(--bg-secondary,#111118)]">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-48 rounded bg-[var(--bg-tertiary,#1a1a24)]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-lg bg-[var(--bg-tertiary,#1a1a24)]"
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (state === "unavailable" || !summary) {
    return (
      <section aria-label="Statut Instatus" className="space-y-2">
        {header}
        <div className="rounded-xl p-5 border border-[var(--border-subtle,#ffffff0d)] bg-[var(--bg-secondary,#111118)] text-center">
          <p className="text-sm text-[var(--text-secondary,#a1a1b5)]">
            Statut externe en cours de configuration.
          </p>
          <p className="text-xs text-[var(--text-tertiary,#6b6b80)] mt-1">
            La page publique sera bientôt disponible sur{" "}
            <code className="text-[var(--accent-primary,#6366f1)]">
              status.deepsightsynthesis.com
            </code>
            .
          </p>
        </div>
      </section>
    );
  }

  const showcaseComponents = summary.components.filter(
    (c) => c.showcase !== false,
  );
  const pageColor =
    summary.page.status === "UP"
      ? "var(--status-success, #10b981)"
      : summary.page.status === "UNDERMAINTENANCE"
        ? "var(--status-warning, #f59e0b)"
        : "var(--status-error, #ef4444)";

  return (
    <section aria-label="Statut Instatus" className="space-y-2">
      {header}

      {/* Status global Instatus */}
      <div
        className="rounded-xl p-5 border"
        style={{
          borderColor: `${pageColor}33`,
          background: `${pageColor}0a`,
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: pageColor }}
            aria-hidden="true"
          />
          <span
            className="text-sm font-medium"
            style={{ color: pageColor }}
          >
            {instatusPageLabel(summary.page.status)}
          </span>
          {summary.activeIncidents.length > 0 && (
            <span className="ml-auto text-xs text-[var(--text-tertiary,#6b6b80)]">
              {summary.activeIncidents.length} incident
              {summary.activeIncidents.length > 1 ? "s" : ""} actif
              {summary.activeIncidents.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Cards composants */}
        {showcaseComponents.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary,#6b6b80)]">
            Aucun composant configuré.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {showcaseComponents.map((c) => {
              const color = instatusStatusColor(c.status);
              return (
                <div
                  key={c.id}
                  className="rounded-lg px-3 py-2.5 border border-[var(--border-subtle,#ffffff0d)] bg-[var(--bg-tertiary,#1a1a24)]/40 flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    {c.group && (
                      <p className="text-xs text-[var(--text-tertiary,#6b6b80)] truncate">
                        {c.group.name}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-xs font-medium tabular-nums shrink-0"
                    style={{ color }}
                  >
                    {instatusStatusLabel(c.status)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Incidents actifs */}
      {summary.activeIncidents.length > 0 && (
        <div className="rounded-xl p-4 border border-[var(--status-error,#ef4444)]/30 bg-[var(--status-error,#ef4444)]/5">
          <h3 className="text-sm font-semibold text-[var(--status-error,#ef4444)] mb-2">
            Incidents en cours
          </h3>
          <ul className="space-y-1">
            {summary.activeIncidents.map((inc) => (
              <li
                key={inc.id}
                className="text-xs text-[var(--text-secondary,#a1a1b5)]"
              >
                {inc.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────

export default function StatusPage() {
  const [data, setData] = useState<DeepSystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(POLL_INTERVAL);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetchStatus = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      // Try deep check first (via Vercel proxy), fallback to public endpoint
      let result: DeepSystemStatus;
      try {
        result = await statusApi.getDeepStatus();
      } catch {
        result = await statusApi.getStatus();
      }
      setData(result);
      setError(null);
    } catch {
      setError("Impossible de joindre l'API");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setCountdown(POLL_INTERVAL);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchStatus();
    const poll = setInterval(() => fetchStatus(), POLL_INTERVAL * 1000);
    return () => clearInterval(poll);
  }, [fetchStatus]);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? POLL_INTERVAL : c - 1));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // ── Error state ──
  if (error && !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary,#0a0a0f)] flex flex-col items-center justify-center p-4">
        <DoodleBackground variant="tech" />
        <div className="text-center max-w-md">
          <XCircle
            size={48}
            className="mx-auto mb-4"
            style={{ color: "#ef4444" }}
          />
          <h2 className="text-2xl font-bold text-[var(--text-primary,#f5f5f7)] mb-2">
            {error}
          </h2>
          <p className="text-[var(--text-secondary,#a1a1b5)] mb-6">
            L'API DeepSight ne r&eacute;pond pas.
          </p>
          <button
            onClick={() => {
              setLoading(true);
              fetchStatus();
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg
                       bg-[var(--accent-primary,#6366f1)] text-white font-medium
                       hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={16} />
            R&eacute;essayer
          </button>
        </div>
      </div>
    );
  }

  // ── Loading skeleton ──
  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary,#0a0a0f)] p-4 md:p-8">
        <DoodleBackground variant="tech" />
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-10 w-64 rounded-lg bg-[var(--bg-tertiary,#1a1a24)]" />
            <div className="h-24 rounded-xl bg-[var(--bg-tertiary,#1a1a24)]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-36 rounded-xl bg-[var(--bg-tertiary,#1a1a24)]"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const overallColor = statusColor(data.status);
  const overallLabel =
    data.status === "operational"
      ? "Tout est op\u00e9rationnel"
      : data.status === "degraded"
        ? "Service d\u00e9grad\u00e9"
        : "Incident en cours";

  const overallEmoji =
    data.status === "operational"
      ? "\uD83D\uDFE2"
      : data.status === "degraded"
        ? "\uD83D\uDFE1"
        : "\uD83D\uDD34";

  return (
    <div className="min-h-screen bg-[var(--bg-primary,#0a0a0f)] text-[var(--text-primary,#f5f5f7)]">
      <DoodleBackground variant="tech" />
      <SEO
        title="Statut des services"
        description="État en temps réel des services DeepSight : API, base de données, IA, paiements."
        path="/status"
        keywords="DeepSight, statut, services, API, uptime, monitoring"
      />
      {/* Header */}
      <header className="border-b border-[var(--border-subtle,#ffffff0d)] bg-[var(--bg-secondary,#111118)]">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity
              size={24}
              style={{ color: "var(--accent-primary, #6366f1)" }}
            />
            <h1 className="text-xl font-bold">Statut DeepSight</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                         bg-[var(--bg-tertiary,#1a1a24)] hover:bg-[var(--accent-primary,#6366f1)]/20
                         text-[var(--text-secondary,#a1a1b5)] hover:text-white
                         transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={refreshing ? "animate-spin" : ""}
              />
              Rafra&icirc;chir
            </button>
            <span className="text-xs text-[var(--text-tertiary,#6b6b80)] tabular-nums">
              v{data.version}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Overall banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl p-6 border"
          style={{
            borderColor: `${overallColor}33`,
            background: `${overallColor}0a`,
          }}
        >
          <div className="flex items-center gap-3">
            <StatusIcon status={data.status} />
            <span
              className="text-lg font-semibold"
              style={{ color: overallColor }}
            >
              {overallEmoji} {overallLabel}
            </span>
          </div>

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--text-secondary,#a1a1b5)]">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} />
              Uptime : {formatUptime(data.uptime_seconds)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw size={14} />
              Prochaine v&eacute;rification dans {countdown}s
            </span>
            {data.memory && data.memory.rss_mb && (
              <span className="inline-flex items-center gap-1.5">
                <Cpu size={14} />
                M&eacute;moire : {data.memory.rss_mb} MB /{" "}
                {data.memory.limit_mb} MB ({data.memory.usage_percent}%)
              </span>
            )}
          </div>
        </motion.div>

        {/* Service cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.services.map((svc: ServiceStatus, i: number) => {
            const meta = SERVICE_META[svc.name] || {
              icon: Activity,
              label: svc.name,
              description: "",
            };
            const Icon = meta.icon;

            return (
              <motion.div
                key={svc.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * (i + 1) }}
                className="rounded-xl p-5 border border-[var(--border-subtle,#ffffff0d)]
                           bg-[var(--bg-secondary,#111118)] hover:bg-[var(--bg-tertiary,#1a1a24)]
                           transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-lg"
                    style={{ backgroundColor: `${statusColor(svc.status)}15` }}
                  >
                    <Icon
                      size={20}
                      style={{ color: statusColor(svc.status) }}
                    />
                  </div>
                  <StatusDot status={svc.status} />
                </div>

                <h3 className="font-semibold mb-0.5">{meta.label}</h3>
                <p className="text-xs text-[var(--text-tertiary,#6b6b80)] mb-3">
                  {meta.description}
                </p>

                <div className="flex items-center justify-between text-xs">
                  <span
                    className="font-medium"
                    style={{ color: statusColor(svc.status) }}
                  >
                    {statusLabel(svc.status)}
                  </span>
                  <span className="text-[var(--text-tertiary,#6b6b80)] tabular-nums">
                    {svc.message || formatLatency(svc.latency_ms)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Live status (Instatus) — section additive, pas de breaking change */}
        <InstatusSection />

        {/* Footer */}
        <div className="text-center text-xs text-[var(--text-muted,#45455a)] space-y-1 pt-4">
          <p>
            Derni&egrave;re v&eacute;rification :{" "}
            {new Date(data.checked_at).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
          <p>DeepSight Monitoring</p>
        </div>
      </main>
    </div>
  );
}
