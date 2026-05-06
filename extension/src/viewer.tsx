import React from "react";
import { createRoot } from "react-dom/client";
import { ViewerApp } from "./viewer/ViewerApp";
import { initPostHog } from "./lib/posthog";

// Pages d'extension = OK pour PostHog (idem sidepanel). Service worker
// `background.ts` et content script restent sans posthog (cf. lib/posthog.ts).
initPostHog();

const params = new URLSearchParams(window.location.search);
const summaryId = parseInt(params.get("id") || "0", 10);

const rootEl = document.getElementById("viewer-root");
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(<ViewerApp summaryId={summaryId} />);
}
