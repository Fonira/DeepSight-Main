/**
 * CrispChat — Loads the Crisp chat widget via VITE_CRISP_WEBSITE_ID.
 * Renders nothing visually; the widget is injected into the DOM by the Crisp script.
 */

import { useEffect } from 'react';

declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID: string;
  }
}

const CRISP_WEBSITE_ID = import.meta.env.VITE_CRISP_WEBSITE_ID as string | undefined;

export const CrispChat: React.FC = () => {
  useEffect(() => {
    if (!CRISP_WEBSITE_ID) return;
    // Avoid double-init
    if (window.$crisp) return;

    window.$crisp = [];
    window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

    const script = document.createElement('script');
    script.src = 'https://client.crisp.chat/l.js';
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount (unlikely but safe)
      script.remove();
    };
  }, []);

  return null;
};

export default CrispChat;
