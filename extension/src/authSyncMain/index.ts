// This script runs in the MAIN world (page context).
// It can access the page's localStorage but NOT chrome.* APIs.
// It communicates with the isolated-world authSync script via postMessage.

export {}; // Make this a module so declare global works

declare global {
  interface Window {
    __DEEPSIGHT_EXTENSION_PRESENT__: boolean;
  }
}

window.__DEEPSIGHT_EXTENSION_PRESENT__ = true;

function syncAuth(): void {
  try {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const userStr = localStorage.getItem('user');

    if (accessToken && refreshToken && userStr) {
      window.postMessage(
        {
          type: 'DEEPSIGHT_AUTH_SUCCESS',
          payload: {
            accessToken,
            refreshToken,
            user: JSON.parse(userStr),
          },
        },
        window.location.origin,
      );
    }
  } catch (e) {
    console.error('[DeepSight] Failed to read localStorage:', e);
  }
}

// Wait for page to fully initialize localStorage
setTimeout(syncAuth, 2000);
