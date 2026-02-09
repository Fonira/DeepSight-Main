import { WEBAPP_URL } from '../utils/config';

// This script runs in the ISOLATED world.
// It listens for messages from the MAIN world script (authSyncMain)
// and forwards auth data to the background service worker.

window.addEventListener('message', async (event: MessageEvent) => {
  if (event.origin !== new URL(WEBAPP_URL).origin) return;

  const { type, payload } = event.data || {};

  if (type === 'DEEPSIGHT_AUTH_SUCCESS') {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'SYNC_AUTH_FROM_WEBSITE',
        data: payload,
      });

      if (response?.success) {
        window.postMessage({ type: 'DEEPSIGHT_EXTENSION_AUTH_SYNCED' }, WEBAPP_URL);
      }
    } catch (e) {
      console.error('[DeepSight Extension] Failed to sync auth:', e);
    }
  }
});
