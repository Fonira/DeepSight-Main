// extension/__tests__/content/helpers/widgetHarness.ts
//
// Petit harness Jest pour rendre la « voice call button » du widget DeepSight
// directement dans `document.body`. Évite de monter tout le content script
// (qui injecte un Shadow DOM via webpack code-split) — ici on teste juste
// le rendu pur du bouton.
import { renderVoiceCallButton } from "../../../src/content/widget";

export interface RenderWidgetOpts {
  plan: "free" | "pro" | "expert";
  trialUsed?: boolean;
  monthlyMinutesUsed?: number;
  videoId?: string;
  videoTitle?: string;
}

export async function renderWidget(opts: RenderWidgetOpts): Promise<void> {
  document.body.innerHTML = '<div id="ds-widget-root"></div>';
  const root = document.getElementById("ds-widget-root");
  if (!root) throw new Error("widgetHarness: root not found");
  await renderVoiceCallButton(root, opts);
}

export function getButtons(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll("button"));
}
