/**
 * Public status page — no auth required.
 * Polls GET /api/health/status every 30s, shows per-service indicators.
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
} from "lucide-react";
import { statusApi, type SystemStatus, type ServiceStatus } from "../services/api";

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 30; // seconds

const SERVICE_META: Record<string, { icon: typeof Database; label: string; description: string }> = {
  database: {
    icon: Database,
    label: "Database",
    description: "PostgreSQL primary store",
  },
  stripe: {
    icon: CreditCard,
    label: "Stripe",
    description: "Payment processing",
  },
  mistral: {
    icon: Brain,
    label: "Mistral AI",
    description: "Analysis & chat engine",
  },
  perplexity: {
    icon: Search,
    label: "Perplexity AI",
    description: "Fact-checking & web search",
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
    <span
      className="relative flex h-3 w-3"
      aria-label={status}
    >
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
  if (status === "operational") return <CheckCircle2 size={18} style={{ color: statusColor(status) }} />;
  if (status === "degraded") return <AlertTriangle size={18} style={{ color: statusColor(status) }} />;
  return <XCircle size={18} style={{ color: statusColor(status) }} />;
}

function formatUptime(seconds: number | null): string {
  if (seconds == null) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function formatLatency(ms: number | null): string {
  if (ms == null) return "—";
  return `${ms.toFixed(0)}ms`;
}

// ───────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────

export default function StatusPage() {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(POLL_INTERVAL);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetchStatus = useCallback(async () => {
    try {
      const result = await statusApi.getStatus();
      setData(result);
      setError(null);
    } catch {
      setError("Cannot reach API");
    } finally {
      setLoading(false);
      setCountdown(POLL_INTERVAL);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchStatus();
    const poll = setInterval(fetchStatus, POLL_INTERVAL * 1000);
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
        <div className="text-center max-w-md">
          <XCircle size={48} className="mx-auto mb-4" style={{ color: "#ef4444" }} />
          <h1 className="text-2xl font-bold text-[var(--text-primary,#f5f5f7)] mb-2">
            {error}
          </h1>
          <p className="text-[var(--text-secondary,#a1a1b5)] mb-6">
            The DeepSight API is not responding.
          </p>
          <button
            onClick={() => { setLoading(true); fetchStatus(); }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg
                       bg-[var(--accent-primary,#6366f1)] text-white font-medium
                       hover:opacity-90 transition-opacity"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Loading skeleton ──
  if (loading || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary,#0a0a0f)] p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-10 w-64 rounded-lg bg-[var(--bg-tertiary,#1a1a24)]" />
            <div className="h-24 rounded-xl bg-[var(--bg-tertiary,#1a1a24)]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-36 rounded-xl bg-[var(--bg-tertiary,#1a1a24)]" />
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
      ? "All Systems Operational"
      : data.status === "degraded"
        ? "Some Systems Degraded"
        : "System Outage Detected";

  return (
    <div className="min-h-screen bg-[var(--bg-primary,#0a0a0f)] text-[var(--text-primary,#f5f5f7)]">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle,#ffffff0d)] bg-[var(--bg-secondary,#111118)]">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity size={24} style={{ color: "var(--accent-primary, #6366f1)" }} />
            <h1 className="text-xl font-bold">DeepSight Status</h1>
          </div>
          <span className="text-xs text-[var(--text-tertiary,#6b6b80)] tabular-nums">
            v{data.version}
          </span>
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
            <span className="text-lg font-semibold" style={{ color: overallColor }}>
              {overallLabel}
            </span>
          </div>

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--text-secondary,#a1a1b5)]">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} />
              Uptime: {formatUptime(data.uptime_seconds)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw size={14} />
              Next check in {countdown}s
            </span>
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
                    <Icon size={20} style={{ color: statusColor(svc.status) }} />
                  </div>
                  <StatusDot status={svc.status} />
                </div>

                <h3 className="font-semibold mb-0.5">{meta.label}</h3>
                <p className="text-xs text-[var(--text-tertiary,#6b6b80)] mb-3">
                  {meta.description}
                </p>

                <div className="flex items-center justify-between text-xs">
                  <span
                    className="font-medium capitalize"
                    style={{ color: statusColor(svc.status) }}
                  >
                    {svc.status}
                  </span>
                  <span className="text-[var(--text-tertiary,#6b6b80)] tabular-nums">
                    {svc.message || formatLatency(svc.latency_ms)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-[var(--text-muted,#45455a)] space-y-1 pt-4">
          <p>
            Last checked:{" "}
            {new Date(data.checked_at).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
          <p>Powered by DeepSight Monitoring</p>
        </div>
      </main>
    </div>
  );
}
