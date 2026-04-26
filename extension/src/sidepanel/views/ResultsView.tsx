import React, { useState } from "react";
import type { Summary, PlanInfo, User } from "../../types";
import Browser from "../../utils/browser-polyfill";
import { WEBAPP_URL } from "../../utils/config";
import { ExternalLinkIcon } from "../shared/Icons";
import { SynthesisView } from "../shared/SynthesisView";
import { FeatureCTAGrid } from "../shared/FeatureCTAGrid";
import { ChatView } from "./ChatView";
import { useTranslation } from "../../i18n/useTranslation";

interface ResultsViewProps {
  summary: Summary;
  summaryId: number;
  user: User | null;
  planInfo: PlanInfo | null;
  isGuest: boolean;
  onNewAnalysis: () => void;
  onLogout: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  summary,
  summaryId,
  user,
  planInfo,
  isGuest,
  onNewAnalysis,
  onLogout,
}) => {
  const { t } = useTranslation();
  const [chatOpen, setChatOpen] = useState(false);

  if (chatOpen) {
    return (
      <ChatView
        summaryId={summaryId}
        videoTitle={summary.video_title}
        onClose={() => setChatOpen(false)}
        onSessionExpired={onLogout}
        userPlan={planInfo?.plan_id || user?.plan || "free"}
      />
    );
  }

  return (
    <div className="results-view">
      {/* Header */}
      <div className="results-header">
        <button className="btn-back" onClick={onNewAnalysis}>
          {"\u2190"} {t.results?.backToAnalysis || "Nouvelle analyse"}
        </button>
        <div className="results-header-right">
          <button
            className="btn-open-webapp"
            onClick={() =>
              Browser.tabs.create({ url: `${WEBAPP_URL}/summary/${summaryId}` })
            }
            title={t.synthesis.fullAnalysis}
          >
            <ExternalLinkIcon size={12} /> Web
          </button>
        </div>
      </div>

      {/* Platform logos strip */}
      <div className="platform-logos-strip">
        <img
          src={Browser.runtime.getURL("platforms/youtube-icon-red.svg")}
          alt="YouTube"
        />
        <img
          src={Browser.runtime.getURL("platforms/tiktok-note-color.svg")}
          alt="TikTok"
        />
        <img
          src={Browser.runtime.getURL("platforms/mistral-icon.svg")}
          alt="Mistral AI"
        />
        <img
          src={Browser.runtime.getURL("platforms/tournesol-logo.png")}
          alt="Tournesol"
        />
      </div>

      {/* Synthesis results */}
      <SynthesisView
        summary={summary}
        summaryId={summaryId}
        planInfo={planInfo}
        onOpenChat={() => setChatOpen(true)}
      />

      {/* Feature CTA Grid */}
      <FeatureCTAGrid
        planInfo={planInfo}
        summaryId={summaryId}
        isGuest={isGuest}
      />

      {/* Guest CTA */}
      {isGuest && (
        <div className="guest-results-cta">
          <p>{t.guest.exhaustedText}</p>
          <button
            className="btn-create-account"
            onClick={() =>
              Browser.tabs.create({ url: `${WEBAPP_URL}/register` })
            }
          >
            {t.common.createAccount} {"\u2197"}
          </button>
        </div>
      )}
    </div>
  );
};
