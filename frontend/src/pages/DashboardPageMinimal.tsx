/**
 * DashboardPageMinimal — landing page minimaliste post-Hub.
 *
 * Default home depuis 2026-04-30 (Task 4 du plan hub-features-completion). La
 * page d'accueil ne fait plus que :
 *   1. Header sobre (greeting + sous-titre)
 *   2. SmartInputBar (mode URL/recherche/texte/etc — UX existante préservée)
 *   3. RecentAnalysesSection (3 dernières analyses, accès rapide → /hub)
 *   4. TournesolTrendingSection (recommandations communauté)
 *
 * Toutes les autres features (chat, voice, customization v4, factcheck,
 * AnalysisHub tabs, audio player, share, export, etc.) vivent désormais
 * exclusivement dans `/hub`. La page legacy est conservée sous le nom
 * `DashboardPageLegacy.tsx` et accessible via :
 *   - `?legacy=1` dans l'URL
 *   - `localStorage.setItem('ds_hub_legacy_home', '1')`
 * pour rollback rapide en cas de bug critique signalé par un user.
 *
 * Le pipeline analyze + redirect vers le Hub est encapsulé dans le hook
 * `useAnalyzeAndOpenHub` (frontend/src/hooks/), partagé avec d'autres entry
 * points (NewConversationModal du Hub, futurs callers).
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import DoodleBackground from "../components/DoodleBackground";
import { SEO } from "../components/SEO";
import { Sidebar } from "../components/layout/Sidebar";
import SmartInputBar, {
  type SmartInputValue,
} from "../components/SmartInputBar";
import { TournesolTrendingSection } from "../components/TournesolTrendingSection";
import { RecentAnalysesSection } from "../components/RecentAnalysesSection";
import { useAnalyzeAndOpenHub } from "../hooks/useAnalyzeAndOpenHub";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "../hooks/useTranslation";

const DashboardPageMinimal: React.FC = () => {
  const { user } = useAuth();
  const { language } = useTranslation();
  const navigate = useNavigate();
  const { analyzing, error, analyze } = useAnalyzeAndOpenHub();

  const [smartInput, setSmartInput] = useState<SmartInputValue>({
    mode: "search",
    searchLanguages: ["fr", "en"],
  });

  const userName = user?.username?.split("@")[0] || "";
  const greeting =
    language === "fr"
      ? `Bonjour ${userName}, que souhaitez-vous comprendre ?`
      : `Hi ${userName}, what do you want to understand?`;

  const subtitle =
    language === "fr"
      ? "Collez un lien YouTube/TikTok ou explorez les recommandations."
      : "Paste a YouTube/TikTok link or browse recommendations.";

  const handleSmartSubmit = () => {
    // Mode URL : déclenche l'analyse via le hook puis redirige vers /hub.
    if (smartInput.mode === "url" && smartInput.url) {
      analyze(smartInput.url);
      return;
    }
    // Modes search / text / image / library : pour l'instant, redirige sur le
    // legacy dashboard où ces flows sont implémentés (le minimal landing
    // n'expose volontairement qu'URL → Hub). À enrichir dans une itération
    // suivante si nécessaire.
    if (smartInput.mode === "search" && smartInput.searchQuery) {
      // Navigation vers la page legacy avec query pré-remplie pour l'instant.
      const qs = new URLSearchParams({
        legacy: "1",
        q: smartInput.searchQuery,
      });
      navigate(`/?${qs.toString()}`);
    }
  };

  const handleRecentSelect = (summaryId: number) => {
    navigate(`/hub?conv=${summaryId}`);
  };

  const handleTournesolPick = (videoId: string) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    analyze(url);
  };

  return (
    <div className="relative min-h-screen flex bg-bg-primary text-text-primary">
      <DoodleBackground variant="default" className="!opacity-[0.18]" />
      <SEO title="Accueil" path="/dashboard" />
      <Sidebar />

      <main
        id="main-content"
        className="flex-1 flex flex-col px-4 sm:px-6 py-8 lg:ml-[240px]"
      >
        <div className="w-full max-w-2xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-medium text-text-primary mb-2">
              {greeting}
            </h1>
            <p className="text-sm text-text-tertiary">{subtitle}</p>
          </header>

          <SmartInputBar
            value={smartInput}
            onChange={setSmartInput}
            onSubmit={handleSmartSubmit}
            loading={analyzing}
            disabled={analyzing}
            language={language}
            userCredits={user?.credits ?? 0}
          />

          {analyzing && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-2 text-[13px] text-indigo-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>
                {language === "fr"
                  ? "Démarrage de l'analyse… suivez la progression en bas à droite."
                  : "Starting analysis… progress shown bottom-right."}
              </span>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] text-red-300">
              <AlertCircle className="w-4 h-4 mt-px flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="w-full mt-12 flex flex-col gap-10">
          <div className="max-w-5xl w-full mx-auto px-4">
            <RecentAnalysesSection
              language={language}
              onVideoSelect={() => {
                /* fallback unused — onOpenAnalysis takes precedence */
              }}
              onOpenAnalysis={(summaryId) => handleRecentSelect(summaryId)}
            />
          </div>

          <TournesolTrendingSection
            language={language}
            onVideoSelect={handleTournesolPick}
          />
        </div>
      </main>
    </div>
  );
};

export default DashboardPageMinimal;
