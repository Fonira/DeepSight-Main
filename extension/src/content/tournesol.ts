// ── Tournesol score fetch + extension detection ──

import Browser from "../utils/browser-polyfill";
import type { TournesolData } from "../types";

export function detectTournesolExtension(): boolean {
  return !!document.querySelector(
    'tournesol-entity-context, [class*="tournesol"], #tournesol-rate',
  );
}

export async function fetchTournesolScore(
  videoId: string,
): Promise<TournesolData | null> {
  try {
    const resp = (await Browser.runtime.sendMessage({
      action: "GET_TOURNESOL",
      data: { videoId },
    })) as { success?: boolean; data?: TournesolData } | undefined;
    if (resp?.success && resp.data) return resp.data;
    return null;
  } catch {
    return null;
  }
}
