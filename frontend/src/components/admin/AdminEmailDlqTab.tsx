/**
 * Admin — Emails non envoyés (Dead Letter Queue), lecture seule.
 * Consomme GET /api/admin/email-dlq?include_body=true.
 *
 * Sans clé Resend, tous les emails (dont les messages du formulaire de
 * contact) finissent dans la table email_dlq : cet onglet permet de les lire.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Mail,
  RefreshCw,
} from "lucide-react";
import { DeepSightSpinner } from "../ui";

export interface EmailDlqItem {
  id: number;
  email_to: string;
  subject: string;
  failed_at: string;
  error_message: string | null;
  replay_status: string;
  body_text: string | null;
}

export interface EmailDlqListResponse {
  items: EmailDlqItem[];
  total: number;
  limit: number;
  offset: number;
}

interface Props {
  adminFetch: (endpoint: string) => Promise<EmailDlqListResponse>;
  language: "fr" | "en";
}

export const EMAIL_DLQ_PAGE_SIZE = 20;

export function AdminEmailDlqTab({ adminFetch, language }: Props) {
  const [data, setData] = useState<EmailDlqListResponse | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = (fr: string, en: string) => (language === "fr" ? fr : en);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = page * EMAIL_DLQ_PAGE_SIZE;
      setData(
        await adminFetch(
          `/api/admin/email-dlq?include_body=true&limit=${EMAIL_DLQ_PAGE_SIZE}&offset=${offset}`,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [adminFetch, page]);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString(language === "fr" ? "fr-FR" : "en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / EMAIL_DLQ_PAGE_SIZE));

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-border-subtle flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">
            {t("Emails non envoyés", "Unsent emails")}
          </h3>
          <p className="text-xs text-text-tertiary">
            {t(
              "Emails en échec d'envoi (dont les messages du formulaire de contact tant que Resend n'est pas configuré).",
              "Emails that could not be sent (including contact form messages while Resend is not configured).",
            )}
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg hover:bg-bg-hover"
          aria-label={t("Rafraîchir", "Refresh")}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading && !data ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <DeepSightSpinner size="md" />
        </div>
      ) : error ? (
        <div className="m-4 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : !data || data.items.length === 0 ? (
        <p className="p-6 text-center text-text-tertiary">
          {t("Aucun email en attente", "No unsent emails")}
        </p>
      ) : (
        <div className="divide-y divide-border-subtle">
          {data.items.map((item) => (
            <details key={item.id} className="p-4 hover:bg-bg-hover">
              <summary className="flex cursor-pointer items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-text-tertiary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.subject}</p>
                  <p className="truncate text-xs text-text-tertiary">
                    {item.email_to} · {item.replay_status}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-text-tertiary">
                  {formatDate(item.failed_at)}
                </span>
              </summary>
              {item.error_message && (
                <p className="mt-3 text-xs text-amber-400">
                  {item.error_message}
                </p>
              )}
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-bg-tertiary p-3 font-sans text-sm text-text-secondary">
                {item.body_text || t("(corps vide)", "(empty body)")}
              </pre>
            </details>
          ))}
        </div>
      )}

      {total > EMAIL_DLQ_PAGE_SIZE && (
        <div className="p-4 border-t border-border-subtle flex items-center justify-between">
          <p className="text-sm text-text-tertiary">
            {t("Page", "Page")} {page + 1} / {pageCount} · {total}{" "}
            {t("emails", "emails")}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="p-2 rounded-lg hover:bg-bg-hover disabled:opacity-50"
              aria-label={t("Page précédente", "Previous page")}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1 || loading}
              className="p-2 rounded-lg hover:bg-bg-hover disabled:opacity-50"
              aria-label={t("Page suivante", "Next page")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
