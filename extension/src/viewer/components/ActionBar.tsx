import React, { useCallback, useState } from "react";
import Browser from "../../utils/browser-polyfill";
import { WEBAPP_URL } from "../../utils/config";
import type { Summary, MessageResponse } from "../../types";

interface Props {
  summary: Summary;
  summaryId: number;
}

function extractVideoId(url: string | undefined): string | null {
  if (!url) return null;
  const yt = url.match(/[?&]v=([^&]+)/);
  if (yt) return yt[1];
  const ytShort = url.match(/youtu\.be\/([^?&]+)/);
  if (ytShort) return ytShort[1];
  const tt = url.match(/tiktok\.com\/[^/]+\/video\/(\d+)/);
  if (tt) return tt[1];
  return null;
}

export const ActionBar: React.FC<Props> = ({ summary, summaryId }) => {
  const [shareLabel, setShareLabel] = useState<string | null>(null);

  const videoId = extractVideoId(summary.video_url);

  const handleShare = useCallback(async () => {
    const fallbackUrl = `${WEBAPP_URL}/summary/${summaryId}`;
    let shareUrl = fallbackUrl;

    if (videoId) {
      try {
        const res = (await Browser.runtime.sendMessage({
          action: "SHARE_ANALYSIS",
          data: { videoId },
        })) as MessageResponse | undefined;
        if (res?.success && res.share_url) {
          shareUrl = res.share_url;
        }
      } catch {
        /* fallback */
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareLabel("Lien copié !");
    } catch {
      setShareLabel("Erreur de copie");
    }
    setTimeout(() => setShareLabel(null), 2200);
  }, [videoId, summaryId]);

  const handleOpenWeb = useCallback(() => {
    Browser.tabs.create({ url: `${WEBAPP_URL}/summary/${summaryId}` });
  }, [summaryId]);

  const handleAnalyzeAnother = useCallback(() => {
    Browser.tabs.create({ url: "https://www.youtube.com" });
  }, []);

  return (
    <div className="v-actions" role="toolbar" aria-label="Actions">
      <button
        type="button"
        className="v-btn v-btn-primary"
        onClick={handleShare}
      >
        <span aria-hidden="true">{"\uD83D\uDD17"}</span>
        <span>{shareLabel ?? "Partager cette analyse"}</span>
      </button>
      <button
        type="button"
        className="v-btn v-btn-secondary"
        onClick={handleOpenWeb}
      >
        <span aria-hidden="true">{"\uD83C\uDF10"}</span>
        <span>Ouvrir sur DeepSight Web</span>
      </button>
      <button
        type="button"
        className="v-btn v-btn-secondary"
        onClick={handleAnalyzeAnother}
      >
        <span aria-hidden="true">{"\uD83C\uDFAC"}</span>
        <span>Analyser une autre vidéo</span>
      </button>
    </div>
  );
};
