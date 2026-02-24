import React, { useState, useEffect } from 'react';

const PROMOS = [
  {
    id: 'web',
    text: 'Full analysis experience on DeepSight Web',
    cta: 'Try it free',
    url: 'https://www.deepsightsynthesis.com',
    gradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  },
  {
    id: 'mobile',
    text: 'DeepSight on your phone — analyze anywhere',
    cta: 'Get the app',
    url: 'https://www.deepsightsynthesis.com/mobile',
    gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
  },
];

export const PromoBanner: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user dismissed promos
    chrome.storage.local.get(['promoDismissed']).then((data) => {
      if (data.promoDismissed) setDismissed(true);
    });
  }, []);

  useEffect(() => {
    if (dismissed) return;
    const timer = setInterval(() => {
      setCurrent((i) => (i + 1) % PROMOS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    chrome.storage.local.set({ promoDismissed: true });
  };

  if (dismissed) return null;

  const promo = PROMOS[current];

  return (
    <div className="promo-banner" style={{ background: promo.gradient }}>
      <div className="promo-content">
        <span className="promo-text">{promo.text}</span>
        <a href={promo.url} target="_blank" rel="noreferrer" className="promo-cta">
          {promo.cta} &rarr;
        </a>
      </div>
      <button className="promo-close" onClick={handleDismiss} title="Dismiss">
        &times;
      </button>
    </div>
  );
};
