/**
 * VoicePacksWidget — Liste packs voice + bouton acheter.
 *
 * Inséré dans MyAccount.tsx section "Voice & Audio" et accessible via
 * l'ancre #voice-packs depuis VoiceCallPage en cas de quota épuisé.
 */

import React, { useEffect, useState } from "react";
import { Mic, ArrowRight, Loader2 } from "lucide-react";
import {
  voicePacksApi,
  type ApiVoicePack,
  type ApiVoiceCreditStatus,
} from "../../services/api";
import { useTranslation } from "../../hooks/useTranslation";

export const VoicePacksWidget: React.FC = () => {
  const [packs, setPacks] = useState<ApiVoicePack[]>([]);
  const [status, setStatus] = useState<ApiVoiceCreditStatus | null>(null);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { language } = useTranslation();
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);

  useEffect(() => {
    Promise.all([voicePacksApi.list(), voicePacksApi.myCredits()])
      .then(([p, s]) => {
        setPacks(p);
        setStatus(s);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Erreur de chargement"),
      );
  }, []);

  const handleBuy = async (slug: string) => {
    setLoadingSlug(slug);
    setError(null);
    try {
      const { checkout_url } = await voicePacksApi.createCheckout(slug);
      window.location.href = checkout_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue");
      setLoadingSlug(null);
    }
  };

  return (
    <section
      id="voice-packs"
      className="card"
      aria-labelledby="voice-packs-heading"
    >
      <div className="panel-header">
        <h2
          id="voice-packs-heading"
          className="font-semibold text-text-primary flex items-center gap-2"
        >
          <Mic className="w-5 h-5 text-indigo-400" />
          {tr("Minutes vocales", "Voice minutes")}
        </h2>
      </div>
      <div className="panel-body space-y-4">
        {status && (
          <div className="rounded-lg border border-white/5 bg-white/5 p-3 text-sm text-text-secondary">
            <p>
              {tr("Allowance restante :", "Allowance remaining:")}{" "}
              <strong className="text-text-primary">
                {status.allowance_remaining.toFixed(1)} /{" "}
                {status.allowance_total.toFixed(0)} min
              </strong>
            </p>
            <p>
              {tr("Minutes achetées :", "Purchased minutes:")}{" "}
              <strong className="text-text-primary">
                {status.purchased_minutes.toFixed(1)} min
              </strong>{" "}
              <span className="text-xs text-text-muted">
                ({tr("n'expirent jamais", "never expire")})
              </span>
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {packs.length === 0 ? (
          <p className="text-sm text-text-muted">
            {tr("Aucun pack disponible", "No packs available")}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {packs.map((p) => (
              <article
                key={p.slug}
                className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2"
              >
                <h3 className="font-semibold text-text-primary">{p.name}</h3>
                <p className="text-2xl font-bold text-indigo-400">
                  {p.minutes}{" "}
                  <span className="text-sm font-normal text-text-muted">
                    min
                  </span>
                </p>
                <p className="text-text-secondary">
                  {(p.price_cents / 100).toFixed(2)} €
                </p>
                <button
                  type="button"
                  onClick={() => handleBuy(p.slug)}
                  disabled={loadingSlug !== null}
                  className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                  aria-label={tr(`Acheter ${p.name}`, `Buy ${p.name}`)}
                >
                  {loadingSlug === p.slug ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {tr("Acheter", "Buy")}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default VoicePacksWidget;
