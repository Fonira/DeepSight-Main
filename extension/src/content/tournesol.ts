// ── Tournesol score fetch ──

import type { TournesolData } from '../types';

export async function fetchTournesolScore(videoId: string): Promise<TournesolData | null> {
  try {
    const resp = await chrome.runtime.sendMessage({
      action: 'GET_TOURNESOL',
      data: { videoId },
    });
    if (resp?.success && resp.data) return resp.data as TournesolData;
    return null;
  } catch {
    return null;
  }
}
