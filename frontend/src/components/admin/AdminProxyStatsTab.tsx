/**
 * Admin — Proxy Decodo MTD stats panel.
 * Consomme GET /api/admin/proxy/usage?days=N.
 * Affiche MTD bytes, requests, headroom vs hard-stop 950 MB, daily timeline,
 * breakdown par provider.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Server,
  Shield,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DeepSightSpinner } from "../ui";

interface DailyEntry {
  date: string;
  bytes_in: number;
  bytes_out: number;
  mb_total: number;
  requests_total: number;
  requests_by_provider: Record<string, number>;
}

interface ProxyUsageResponse {
  total_bytes_mtd: number;
  total_requests_mtd: number;
  mtd_mb: number;
  hard_stop_threshold_mb: number;
  proxy_disabled_env: boolean;
  daily: DailyEntry[];
  by_provider: Record<string, { requests: number; share_pct: number }>;
}

interface Props {
  adminFetch: (
    endpoint: string,
    options?: RequestInit,
  ) => Promise<ProxyUsageResponse>;
  language: "fr" | "en";
}

const SEVERITY_COLORS = {
  ok: "#10b981",
  warning: "#f59e0b",
  critical: "#f97316",
  hard_stop: "#ef4444",
} as const;

function computeSeverity(
  mtd_mb: number,
  threshold_mb: number,
): keyof typeof SEVERITY_COLORS {
  const pct = (mtd_mb / threshold_mb) * 100;
  if (pct < 30) return "ok";
  if (pct < 55) return "warning";
  if (pct < 85) return "critical";
  return "hard_stop";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(3)} GB`;
}

export function AdminProxyStatsTab({ adminFetch, language }: Props) {
  const [data, setData] = useState<ProxyUsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number>(30);

  const t = (fr: string, en: string) => (language === "fr" ? fr : en);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminFetch(`/api/admin/proxy/usage?days=${days}`);
      setData(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [adminFetch, days]);

  useEffect(() => {
    load();
  }, [load]);

  const severity = useMemo(
    () =>
      data ? computeSeverity(data.mtd_mb, data.hard_stop_threshold_mb) : "ok",
    [data],
  );

  const providerChartData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.by_provider)
      .map(([name, value]) => ({
        name,
        requests: value.requests,
        share_pct: value.share_pct,
      }))
      .sort((a, b) => b.requests - a.requests);
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <DeepSightSpinner size="md" />
        <p className="text-sm text-text-tertiary">
          {t("Chargement des stats proxy…", "Loading proxy stats…")}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <AlertTriangle className="h-5 w-5 text-red-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-300">
            {t("Erreur de chargement", "Loading error")}
          </p>
          <p className="text-xs text-red-400">{error}</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20"
        >
          {t("Réessayer", "Retry")}
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const severityColor = SEVERITY_COLORS[severity];
  const pctUsed = (data.mtd_mb / data.hard_stop_threshold_mb) * 100;
  const headroomMb = Math.max(0, data.hard_stop_threshold_mb - data.mtd_mb);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
            <Server className="h-5 w-5 text-violet-400" />
            {t("Proxy Decodo — MTD", "Proxy Decodo — MTD")}
          </h2>
          <p className="text-xs text-text-tertiary">
            {t(
              "Bandwidth proxy résidentiel ($4/GB). Hard-stop auto à 950 MB.",
              "Residential proxy bandwidth ($4/GB). Auto hard-stop at 950 MB.",
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 p-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded px-2 py-1 text-xs ${
                  days === d
                    ? "bg-violet-500/20 text-violet-200"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {d}j
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-text-secondary hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            {t("Refresh", "Refresh")}
          </button>
        </div>
      </div>

      {/* Status banner */}
      {data.proxy_disabled_env && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <Shield className="h-5 w-5 text-amber-400" />
          <p className="text-sm text-amber-200">
            {t(
              "PROXY_DISABLED=true — toutes les requêtes proxifiables passent en direct (fallback IP datacenter Hetzner).",
              "PROXY_DISABLED=true — all proxy-eligible requests fall back to direct (Hetzner datacenter IP).",
            )}
          </p>
        </div>
      )}

      {severity === "hard_stop" && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-red-200">
            {t(
              `Hard-stop imminent (${data.mtd_mb.toFixed(0)} MB / ${data.hard_stop_threshold_mb} MB). Le proxy sera automatiquement bypass.`,
              `Hard-stop imminent (${data.mtd_mb.toFixed(0)} MB / ${data.hard_stop_threshold_mb} MB). Proxy will auto-bypass.`,
            )}
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/5 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wider text-text-tertiary">
            {t("Bandwidth MTD", "MTD bandwidth")}
          </p>
          <p className="mt-1 text-2xl font-bold text-text-primary">
            {data.mtd_mb.toFixed(1)}{" "}
            <span className="text-sm font-normal text-text-tertiary">MB</span>
          </p>
          <p className="text-xs text-text-tertiary">
            {formatBytes(data.total_bytes_mtd)} ·{" "}
            {((data.mtd_mb / 1024) * 4).toFixed(2)} USD{" "}
            <span className="text-text-tertiary/60">{t("estim.", "est.")}</span>
          </p>
        </div>

        <div className="rounded-lg border border-white/5 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wider text-text-tertiary">
            {t("Requêtes MTD", "MTD requests")}
          </p>
          <p className="mt-1 text-2xl font-bold text-text-primary">
            {data.total_requests_mtd.toLocaleString()}
          </p>
          <p className="text-xs text-text-tertiary">
            {Object.keys(data.by_provider).length} {t("providers", "providers")}
          </p>
        </div>

        <div className="rounded-lg border border-white/5 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wider text-text-tertiary">
            {t("Headroom", "Headroom")}
          </p>
          <p
            className="mt-1 text-2xl font-bold"
            style={{ color: severityColor }}
          >
            {headroomMb.toFixed(0)}{" "}
            <span className="text-sm font-normal text-text-tertiary">MB</span>
          </p>
          <p className="text-xs text-text-tertiary">
            {pctUsed.toFixed(1)}% {t("utilisé", "used")}
          </p>
        </div>
      </div>

      {/* Progress bar vers hard-stop */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-text-tertiary">
          <span>
            {t("Vers hard-stop", "Toward hard-stop")} (
            {data.hard_stop_threshold_mb} MB)
          </span>
          <span style={{ color: severityColor }}>{pctUsed.toFixed(1)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full transition-all"
            style={{
              width: `${Math.min(100, pctUsed)}%`,
              backgroundColor: severityColor,
            }}
          />
        </div>
      </div>

      {/* Daily timeline */}
      <div className="rounded-lg border border-white/5 bg-white/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-text-primary">
            {t(`Timeline (${days} derniers jours)`, `Timeline (last ${days} days)`)}
          </h3>
        </div>
        {data.daily.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-tertiary">
            {t("Aucune donnée sur la période", "No data for this period")}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                tickFormatter={(value: string) => {
                  const parts = value.split("-");
                  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : value;
                }}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                label={{
                  value: "MB",
                  angle: -90,
                  position: "insideLeft",
                  fill: "rgba(255,255,255,0.4)",
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#12121a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                formatter={(value: number, name: string) => {
                  if (name === "mb_total") return [`${value.toFixed(2)} MB`, "Total"];
                  if (name === "requests_total")
                    return [value.toLocaleString(), t("Requêtes", "Requests")];
                  return [value, name];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}
              />
              <Line
                type="monotone"
                dataKey="mb_total"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: "#8b5cf6", r: 3 }}
                activeDot={{ r: 5 }}
                name={t("MB / jour", "MB / day")}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Provider breakdown */}
      <div className="rounded-lg border border-white/5 bg-white/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-text-primary">
            {t("Breakdown par provider (MTD)", "Provider breakdown (MTD)")}
          </h3>
        </div>
        {providerChartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-tertiary">
            {t("Aucun provider tracké ce mois", "No tracked provider this month")}
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(200, providerChartData.length * 32)}>
              <BarChart
                data={providerChartData}
                layout="vertical"
                margin={{ top: 5, right: 24, left: 8, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  type="number"
                  tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#12121a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                  formatter={(value: number, name: string) => {
                    if (name === "requests") return [value.toLocaleString(), t("Requêtes", "Requests")];
                    if (name === "share_pct") return [`${value.toFixed(1)}%`, t("Part", "Share")];
                    return [value, name];
                  }}
                />
                <Bar dataKey="requests" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {providerChartData.slice(0, 6).map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-md border border-white/5 bg-white/5 px-3 py-1.5"
                >
                  <span className="font-mono text-xs text-text-secondary">
                    {p.name}
                  </span>
                  <span className="text-xs text-text-tertiary">
                    {p.requests.toLocaleString()}{" "}
                    <span className="text-text-tertiary/60">
                      ({p.share_pct.toFixed(1)}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
