/**
 * DEEP SIGHT v6.0 — API Documentation Page
 *
 * Documentation interactive de l'API publique v1 pour les utilisateurs Expert.
 * Affiche les endpoints, schémas, exemples curl, et gestion de clé API.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../hooks/useTranslation";
import { SEO } from "../components/SEO";
import { BreadcrumbJsonLd } from "../components/BreadcrumbJsonLd";
import {
  Key,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lock,
  Zap,
  BookOpen,
  Terminal,
  Shield,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Endpoint {
  method: "GET" | "POST" | "DELETE";
  path: string;
  description: string;
  auth: boolean;
  params?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  body?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    default?: string;
  }[];
  responseExample: string;
  curlExample: string;
  status?: "stable" | "beta" | "coming_soon";
}

// ─── Endpoint Data ──────────────────────────────────────────────────────────

const API_BASE = "https://api.deepsightsynthesis.com/api/v1";

const endpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/health",
    description:
      "Vérifier que l'API est opérationnelle. Aucune authentification requise.",
    auth: false,
    responseExample: JSON.stringify(
      {
        status: "healthy",
        api_version: "v1",
        service: "deepsight-api-public",
        timestamp: "2026-03-14T10:30:00",
      },
      null,
      2,
    ),
    curlExample: `curl ${API_BASE}/health`,
    status: "stable",
  },
  {
    method: "GET",
    path: "/me",
    description:
      "Récupérer les informations de l'utilisateur authentifié et ses limites.",
    auth: true,
    responseExample: JSON.stringify(
      {
        user_id: 42,
        email: "you@example.com",
        plan: "expert",
        rate_limits: {
          requests_per_minute: 60,
          requests_per_day: 1000,
          requests_remaining: 58,
          daily_remaining: 990,
        },
      },
      null,
      2,
    ),
    curlExample: `curl -H "X-API-Key: ds_live_YOUR_KEY" \\\n  ${API_BASE}/me`,
    status: "stable",
  },
  {
    method: "POST",
    path: "/analyze",
    description:
      "Lancer l'analyse d'une vidéo YouTube. Retourne l'analyse complète.",
    auth: true,
    body: [
      {
        name: "url",
        type: "string",
        required: true,
        description: "URL YouTube de la vidéo",
      },
      {
        name: "mode",
        type: '"express" | "standard" | "detailed"',
        required: false,
        description: "Mode d'analyse",
        default: '"standard"',
      },
      {
        name: "language",
        type: '"fr" | "en" | "auto"',
        required: false,
        description: "Langue de sortie",
        default: '"auto"',
      },
      {
        name: "include_concepts",
        type: "boolean",
        required: false,
        description: "Inclure le glossaire",
        default: "true",
      },
      {
        name: "include_timestamps",
        type: "boolean",
        required: false,
        description: "Inclure les timestamps",
        default: "true",
      },
    ],
    responseExample: JSON.stringify(
      {
        success: true,
        analysis_id: "1234",
        video_id: "dQw4w9WgXcQ",
        title: "Video Title",
        summary: "...",
        concepts: [],
        duration_seconds: 45,
        credits_used: 20,
      },
      null,
      2,
    ),
    curlExample: `curl -X POST -H "X-API-Key: ds_live_YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url": "https://youtube.com/watch?v=xxx", "mode": "standard"}' \\\n  ${API_BASE}/analyze`,
    status: "coming_soon",
  },
  {
    method: "GET",
    path: "/analysis/{id}",
    description: "Récupérer une analyse existante par son ID.",
    auth: true,
    params: [
      {
        name: "id",
        type: "string",
        required: true,
        description: "ID de l'analyse",
      },
    ],
    responseExample: JSON.stringify(
      {
        id: "1234",
        video_id: "dQw4w9WgXcQ",
        title: "Video Title",
        summary: "...",
        concepts: null,
        created_at: "2026-03-14T10:30:00",
        mode: "standard",
      },
      null,
      2,
    ),
    curlExample: `curl -H "X-API-Key: ds_live_YOUR_KEY" \\\n  ${API_BASE}/analysis/1234`,
    status: "stable",
  },
  {
    method: "POST",
    path: "/chat",
    description: "Poser une question contextuelle sur une vidéo déjà analysée.",
    auth: true,
    body: [
      {
        name: "video_id",
        type: "string",
        required: true,
        description: "ID YouTube de la vidéo",
      },
      {
        name: "question",
        type: "string",
        required: true,
        description: "Question (max 2000 caractères)",
      },
      {
        name: "web_search",
        type: "boolean",
        required: false,
        description: "Enrichir avec recherche web (+5 crédits)",
        default: "false",
      },
      {
        name: "context_mode",
        type: '"video" | "expanded"',
        required: false,
        description: "Contexte vidéo seul ou élargi",
        default: '"video"',
      },
    ],
    responseExample: JSON.stringify(
      {
        success: true,
        answer: "La vidéo explique que...",
        sources: null,
        web_enriched: false,
        credits_used: 5,
      },
      null,
      2,
    ),
    curlExample: `curl -X POST -H "X-API-Key: ds_live_YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"video_id": "dQw4w9WgXcQ", "question": "Quel est le sujet principal ?"}' \\\n  ${API_BASE}/chat`,
    status: "stable",
  },
  {
    method: "GET",
    path: "/history",
    description: "Historique paginé des analyses de l'utilisateur.",
    auth: true,
    params: [
      {
        name: "limit",
        type: "number",
        required: false,
        description: "Nombre de résultats (max 100, défaut 20)",
      },
      {
        name: "offset",
        type: "number",
        required: false,
        description: "Point de départ (défaut 0)",
      },
    ],
    responseExample: JSON.stringify(
      {
        items: [
          {
            id: "1234",
            video_id: "xxx",
            title: "...",
            analyzed_at: "...",
            mode: "standard",
          },
        ],
        pagination: { total: 42, limit: 20, offset: 0, has_more: true },
      },
      null,
      2,
    ),
    curlExample: `curl -H "X-API-Key: ds_live_YOUR_KEY" \\\n  "${API_BASE}/history?limit=10&offset=0"`,
    status: "stable",
  },
  {
    method: "GET",
    path: "/usage",
    description:
      "Statistiques d'utilisation de l'API (requêtes, quotas restants).",
    auth: true,
    responseExample: JSON.stringify(
      {
        today: { requests: 42, limit: 1000, remaining: 958 },
        this_month: { estimated_requests: 1260 },
        rate_limits: {
          per_minute: 60,
          per_day: 1000,
          current_minute_remaining: 58,
        },
      },
      null,
      2,
    ),
    curlExample: `curl -H "X-API-Key: ds_live_YOUR_KEY" \\\n  ${API_BASE}/usage`,
    status: "stable",
  },
  {
    method: "GET",
    path: "/videos/{video_id}",
    description:
      "Informations sur une vidéo analysée (titre, thumbnail, analyses).",
    auth: true,
    params: [
      {
        name: "video_id",
        type: "string",
        required: true,
        description: "ID YouTube de la vidéo",
      },
    ],
    responseExample: JSON.stringify(
      {
        video_id: "dQw4w9WgXcQ",
        title: "Video Title",
        thumbnail: "https://...",
        analyses: [{ id: "1234", mode: "standard", created_at: "..." }],
      },
      null,
      2,
    ),
    curlExample: `curl -H "X-API-Key: ds_live_YOUR_KEY" \\\n  ${API_BASE}/videos/dQw4w9WgXcQ`,
    status: "stable",
  },
  {
    method: "POST",
    path: "/batch/analyze",
    description: "Analyse batch de plusieurs vidéos (max 10 URLs par requête).",
    auth: true,
    body: [
      {
        name: "urls",
        type: "string[]",
        required: true,
        description: "Liste d'URLs YouTube (max 10)",
      },
      {
        name: "mode",
        type: '"express" | "standard"',
        required: false,
        description: "Mode d'analyse",
        default: '"express"',
      },
    ],
    responseExample: JSON.stringify(
      {
        job_id: "abc-123",
        status: "queued",
        videos_count: 3,
        estimated_credits: 30,
        estimated_time_seconds: 90,
      },
      null,
      2,
    ),
    curlExample: `curl -X POST -H "X-API-Key: ds_live_YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"urls": ["https://youtube.com/watch?v=a", "https://youtube.com/watch?v=b"], "mode": "express"}' \\\n  ${API_BASE}/batch/analyze`,
    status: "beta",
  },
];

// ─── Helper Components ──────────────────────────────────────────────────────

const MethodBadge: React.FC<{ method: string }> = ({ method }) => {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span
      className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded border ${colors[method] || "bg-gray-500/20 text-gray-400"}`}
    >
      {method}
    </span>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, { bg: string; label: string }> = {
    stable: { bg: "bg-emerald-500/15 text-emerald-400", label: "Stable" },
    beta: { bg: "bg-amber-500/15 text-amber-400", label: "Beta" },
    coming_soon: { bg: "bg-gray-500/15 text-gray-400", label: "Bientot" },
  };
  const s = styles[status] || styles.stable;
  return (
    <span
      className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${s.bg}`}
    >
      {s.label}
    </span>
  );
};

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-text-tertiary hover:text-text-primary"
      title="Copier"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
};

// ─── Endpoint Card ──────────────────────────────────────────────────────────

const EndpointCard: React.FC<{ endpoint: Endpoint }> = ({ endpoint }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-text-tertiary flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-tertiary flex-shrink-0" />
        )}
        <MethodBadge method={endpoint.method} />
        <code className="text-sm font-mono text-text-primary">
          {endpoint.path}
        </code>
        {endpoint.auth && (
          <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        )}
        <StatusBadge status={endpoint.status || "stable"} />
        <span className="text-sm text-text-secondary ml-auto hidden md:block">
          {endpoint.description.slice(0, 60)}
          {endpoint.description.length > 60 ? "..." : ""}
        </span>
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-white/5">
          <p className="text-sm text-text-secondary">{endpoint.description}</p>

          {/* Parameters */}
          {endpoint.params && endpoint.params.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                Parametres URL
              </h4>
              <div className="space-y-1">
                {endpoint.params.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-baseline gap-3 text-sm"
                  >
                    <code className="text-accent-blue font-mono">{p.name}</code>
                    <span className="text-text-tertiary text-xs">{p.type}</span>
                    {p.required && (
                      <span className="text-[10px] text-red-400 font-medium">
                        requis
                      </span>
                    )}
                    <span className="text-text-secondary">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Body */}
          {endpoint.body && endpoint.body.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                Corps (JSON)
              </h4>
              <div className="bg-black/30 rounded-lg p-3 space-y-1.5">
                {endpoint.body.map((b) => (
                  <div
                    key={b.name}
                    className="flex items-baseline gap-3 text-sm flex-wrap"
                  >
                    <code className="text-accent-violet font-mono">
                      {b.name}
                    </code>
                    <span className="text-text-tertiary text-xs">{b.type}</span>
                    {b.required ? (
                      <span className="text-[10px] text-red-400 font-medium">
                        requis
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-tertiary">
                        optionnel
                      </span>
                    )}
                    {b.default && (
                      <span className="text-[10px] text-text-tertiary">
                        defaut: {b.default}
                      </span>
                    )}
                    <span className="text-text-secondary text-xs">
                      {b.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Curl Example */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                Exemple cURL
              </h4>
              <CopyButton
                text={endpoint.curlExample.replace(/\\\n\s*/g, " ")}
              />
            </div>
            <pre className="bg-black/40 rounded-lg p-3 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap">
              {endpoint.curlExample}
            </pre>
          </div>

          {/* Response Example */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                Reponse
              </h4>
              <CopyButton text={endpoint.responseExample} />
            </div>
            <pre className="bg-black/40 rounded-lg p-3 text-xs text-amber-200 font-mono overflow-x-auto max-h-48 overflow-y-auto">
              {endpoint.responseExample}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Page ──────────────────────────────────────────────────────────────

export const ApiDocsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-bg-primary">
      <SEO
        title="Documentation API"
        description="Documentation de l'API publique DeepSight v1 : endpoints, authentification par clé API, exemples curl, schémas de réponse. Réservé au plan Pro."
        path="/api-docs"
        keywords="DeepSight, API, documentation, REST, clé API, endpoints"
      />
      <BreadcrumbJsonLd path="/api-docs" />
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-text-tertiary hover:text-text-primary transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-accent-blue/15 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-accent-blue" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">API Documentation</h1>
              <p className="text-text-secondary text-sm">
                DeepSight Public API v1 — Plan Expert
              </p>
            </div>
          </div>
          <p className="text-text-secondary max-w-2xl">
            Integrez DeepSight dans vos outils et automatisez l'analyse de
            videos YouTube. L'API REST retourne du JSON et utilise des API keys
            pour l'authentification.
          </p>
        </div>

        {/* Quick Start */}
        <div className="card-elevated p-6 rounded-2xl mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Demarrage rapide
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-accent-blue/20 text-accent-blue text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                1
              </span>
              <div>
                <p className="text-sm font-medium">Generez votre cle API</p>
                <p className="text-xs text-text-tertiary">
                  Depuis{" "}
                  <button
                    onClick={() => navigate("/account")}
                    className="text-accent-blue hover:underline"
                  >
                    Mon compte
                  </button>
                  , section "Cle API". Necessite le plan Expert.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-accent-blue/20 text-accent-blue text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                2
              </span>
              <div>
                <p className="text-sm font-medium">Authentifiez vos requetes</p>
                <pre className="bg-black/30 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 mt-1">
                  {`curl -H "X-API-Key: ds_live_YOUR_KEY" \\\n  ${API_BASE}/me`}
                </pre>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-accent-blue/20 text-accent-blue text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                3
              </span>
              <div>
                <p className="text-sm font-medium">
                  Explorez les endpoints ci-dessous
                </p>
                <p className="text-xs text-text-tertiary">
                  Chaque endpoint est documenté avec des exemples curl et des
                  réponses type.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card-elevated p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold">Authentification</h3>
            </div>
            <p className="text-xs text-text-tertiary">
              Header <code className="text-accent-blue">X-API-Key</code> ou{" "}
              <code className="text-accent-blue">Authorization: Bearer</code>.
              Format : <code className="text-accent-violet">ds_live_xxx</code>
            </p>
          </div>

          <div className="card-elevated p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold">Rate Limiting</h3>
            </div>
            <p className="text-xs text-text-tertiary">
              60 requetes/minute, 1000 requetes/jour. Headers{" "}
              <code className="text-accent-blue">X-RateLimit-*</code> dans
              chaque reponse.
            </p>
          </div>

          <div className="card-elevated p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-accent-blue" />
              <h3 className="text-sm font-semibold">Base URL</h3>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs text-accent-violet font-mono break-all">
                {API_BASE}
              </code>
              <CopyButton text={API_BASE} />
            </div>
          </div>
        </div>

        {/* Endpoints */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Endpoints</h2>
          <div className="space-y-2">
            {endpoints.map((ep, idx) => (
              <EndpointCard key={idx} endpoint={ep} />
            ))}
          </div>
        </div>

        {/* Error Codes */}
        <div className="card-elevated p-6 rounded-2xl mb-8">
          <h2 className="text-lg font-semibold mb-4">Codes d'erreur</h2>
          <div className="space-y-2 text-sm">
            {[
              {
                code: "401",
                desc: "Cle API manquante, invalide, ou revoquee",
                color: "text-red-400",
              },
              {
                code: "403",
                desc: "Plan insuffisant (Expert requis)",
                color: "text-amber-400",
              },
              {
                code: "404",
                desc: "Ressource non trouvee (analyse, video)",
                color: "text-orange-400",
              },
              {
                code: "429",
                desc: "Rate limit depasse — voir retry_after dans la reponse",
                color: "text-yellow-400",
              },
              {
                code: "501",
                desc: "Endpoint en cours de developpement (coming soon)",
                color: "text-gray-400",
              },
              {
                code: "503",
                desc: "Service temporairement indisponible",
                color: "text-red-400",
              },
            ].map((err) => (
              <div key={err.code} className="flex items-baseline gap-3">
                <code className={`font-mono font-bold ${err.color}`}>
                  {err.code}
                </code>
                <span className="text-text-secondary">{err.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Credits Info */}
        <div className="card-elevated p-6 rounded-2xl mb-8">
          <h2 className="text-lg font-semibold mb-4">Credits par operation</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { op: "Analyse express", cost: "10", icon: Zap },
              { op: "Analyse standard", cost: "20", icon: BookOpen },
              { op: "Analyse detailed", cost: "50", icon: BookOpen },
              { op: "Chat (sans web)", cost: "5", icon: Terminal },
              { op: "Chat (avec web)", cost: "10", icon: RefreshCw },
            ].map((item) => (
              <div
                key={item.op}
                className="bg-white/[0.03] rounded-xl p-3 text-center"
              >
                <item.icon className="w-4 h-4 mx-auto text-text-tertiary mb-1" />
                <p className="text-xs text-text-secondary">{item.op}</p>
                <p className="text-lg font-bold text-accent-blue">
                  {item.cost}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-8">
          <p className="text-text-tertiary text-sm mb-4">
            Besoin d'aide ? Contactez-nous a{" "}
            <a
              href="mailto:contact@deepsightsynthesis.com"
              className="text-accent-blue hover:underline"
            >
              contact@deepsightsynthesis.com
            </a>
          </p>
          <button
            onClick={() => navigate("/upgrade")}
            className="btn btn-primary px-6 py-2.5"
          >
            Passer au plan Expert
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiDocsPage;
