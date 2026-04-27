// extension/src/content/widget.ts
//
// Widget — Voice Call button.
//
// Stratégie : ce module est chargé à la demande (par le content script ou
// directement via Webpack code-split) et expose `renderVoiceCallButton`
// qui injecte le bouton "🎙️ Appeler la vidéo" dans un container DOM
// fourni par l'appelant (ex : `#ds-widget-root` ou un slot Shadow DOM).
//
// Quotas affichés selon le plan :
//   - free + !trialUsed → badge "1 essai gratuit"
//   - free + trialUsed  → bouton désactivé "Essai utilisé"
//   - pro               → CTA upgrade (Pro n'a pas voice call)
//   - expert            → "X min restantes" (sur 30 min/mois)
//
// Click → envoie `chrome.runtime.sendMessage({ type: "OPEN_VOICE_CALL", … })`
// au service worker, qui ouvre le side panel et stocke le contexte vidéo.

export interface VoiceCallButtonOpts {
  plan: "free" | "pro" | "expert";
  trialUsed?: boolean;
  monthlyMinutesUsed?: number;
  videoId?: string;
  videoTitle?: string;
}

const EXPERT_MONTHLY_MIN = 30;

/**
 * Injecte un bouton "🎙️ Appeler la vidéo" dans `root` avec un badge
 * dynamique selon le plan utilisateur.
 *
 * Idempotent côté caller — chaque appel ajoute un nouveau bouton (à toi
 * de vider `root.innerHTML` avant si re-render).
 */
export async function renderVoiceCallButton(
  root: HTMLElement,
  opts: VoiceCallButtonOpts,
): Promise<void> {
  const btn = document.createElement("button");
  btn.className = "ds-voice-call-btn";
  btn.style.cssText = [
    "width:100%",
    "background:linear-gradient(135deg,#ec4899,#8b5cf6)",
    "color:#fff",
    "border:none",
    "padding:12px",
    "border-radius:8px",
    "font-weight:600",
    "font-size:13px",
    "margin-top:8px",
    "cursor:pointer",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "gap:8px",
  ].join(";");
  btn.innerHTML = `<span>🎙️ Appeler la vidéo</span>`;

  if (opts.plan === "free" && !opts.trialUsed) {
    btn.innerHTML += `<span style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;font-size:10px">1 essai gratuit</span>`;
  }
  if (opts.plan === "free" && opts.trialUsed) {
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
    btn.title = "Essai utilisé — passer en Expert";
    btn.innerHTML += `<span style="font-size:10px;opacity:0.7">Essai utilisé</span>`;
  }
  if (opts.plan === "expert") {
    const remaining = EXPERT_MONTHLY_MIN - (opts.monthlyMinutesUsed ?? 0);
    btn.innerHTML += `<span style="font-size:10px;opacity:0.7">${remaining} min restantes</span>`;
  }

  btn.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "OPEN_VOICE_CALL",
      videoId: opts.videoId,
      videoTitle: opts.videoTitle,
    });
  });

  root.appendChild(btn);
}
