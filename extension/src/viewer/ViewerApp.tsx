import React, { useEffect, useState } from "react";
import Browser from "../utils/browser-polyfill";
import type { Summary, MessageResponse } from "../types";
import { parseAnalysisToSummary } from "../utils/sanitize";
import { ViewerHeader } from "./components/ViewerHeader";
import { VerdictSection } from "./components/VerdictSection";
import { KeyPointsSection } from "./components/KeyPointsSection";
import { DetailedAnalysis } from "./components/DetailedAnalysis";
import { FactCheckSection } from "./components/FactCheckSection";
import { ActionBar } from "./components/ActionBar";

interface Props {
  summaryId: number;
}

export const ViewerApp: React.FC<Props> = ({ summaryId }) => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!summaryId) {
      setError("ID d'analyse manquant");
      setLoading(false);
      return;
    }

    let cancelled = false;

    Browser.runtime
      .sendMessage({
        action: "GET_SUMMARY",
        data: { summaryId },
      })
      .then((resp) => {
        if (cancelled) return;
        const response = resp as MessageResponse | undefined;
        if (response?.success && response.summary) {
          setSummary(response.summary as Summary);
        } else {
          setError(response?.error || "Analyse introuvable");
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError((e as Error).message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [summaryId]);

  if (loading) {
    return (
      <div className="viewer-loading">
        <div className="viewer-spinner" aria-hidden="true" />
        <p>Chargement de l'analyse…</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="viewer-error">
        <h1>Analyse introuvable</h1>
        <p>{error ?? "Aucune donnée retournée."}</p>
        <button
          type="button"
          className="v-btn v-btn-primary"
          onClick={() => window.close()}
        >
          Fermer
        </button>
      </div>
    );
  }

  const parsed = parseAnalysisToSummary(summary.summary_content);

  return (
    <div className="viewer-container">
      <ViewerHeader summary={summary} />
      <VerdictSection verdict={parsed.verdict} />
      <KeyPointsSection points={parsed.keyPoints} />
      <FactCheckSection facts={summary.facts_to_verify ?? []} />
      <DetailedAnalysis content={summary.summary_content} />
      <ActionBar summary={summary} summaryId={summary.id} />
    </div>
  );
};
