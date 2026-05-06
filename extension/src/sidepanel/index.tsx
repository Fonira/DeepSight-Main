import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initPostHog } from "../lib/posthog";
import "./styles/sidepanel.css";

// Init PostHog dès que la page d'extension est chargée. No-op si la clé
// `POSTHOG_KEY` (build var) est absente, donc safe en CI / dev local.
initPostHog();

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
