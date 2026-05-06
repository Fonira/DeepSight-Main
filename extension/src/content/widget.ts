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
//
// i18n (I5) : lit la langue stockée dans chrome.storage.sync.ds_language
// (mêmes clés que useTranslation côté sidepanel). FR par défaut si absent
// ou si lecture échoue.

import fr from "../i18n/fr.json";
import en from "../i18n/en.json";

export interface VoiceCallButtonOpts {
  plan: "free" | "pro" | "expert";
  trialUsed?: boolean;
  monthlyMinutesUsed?: number;
  videoId?: string;
  videoTitle?: string;
}

const EXPERT_MONTHLY_MIN = 30;
const TRANSLATIONS = { fr, en } as const;
type Language = keyof typeof TRANSLATIONS;
const STORAGE_KEY = "ds_language";

/**
 * Lit la langue stockée par useTranslation côté sidepanel.
 * Fallback "fr" si chrome.storage absent (test) ou clé non set.
 */
async function getLanguage(): Promise<Language> {
  try {
    const storage = (
      chrome as unknown as {
        storage?: {
          sync?: { get?: (key: string) => Promise<Record<string, unknown>> };
        };
      }
    ).storage;
    if (!storage?.sync?.get) return "fr";
    const data = await storage.sync.get(STORAGE_KEY);
    const lang = data[STORAGE_KEY];
    if (lang === "fr" || lang === "en") return lang;
    return "fr";
  } catch {
    return "fr";
  }
}

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
  const lang = await getLanguage();
  const t = TRANSLATIONS[lang].voiceCall;

  const btn = document.createElement("button");
  btn.className = "ds-voice-call-btn";
  btn.setAttribute("aria-label", t.buttonAriaLabel);
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
  // Le bouton page YouTube garde le label long ("🎙️ Appeler la vidéo")
  // car il a plus de place que le bouton sidepanel.
  const labelText = t.buttonLabelFloating;
  btn.innerHTML = `<span>${labelText}</span>`;

  if (opts.plan === "free" && !opts.trialUsed) {
    btn.innerHTML += `<span style="background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;font-size:10px">${t.trialBadge}</span>`;
  }
  if (opts.plan === "free" && opts.trialUsed) {
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
    btn.title = t.trialUsedTitle;
    btn.innerHTML += `<span style="font-size:10px;opacity:0.7">${t.trialUsed}</span>`;
  }
  if (opts.plan === "expert" || opts.plan === "pro") {
    // [N5] Math.max protège contre overflow si backend renvoie used > quota.
    const remaining = Math.max(
      0,
      EXPERT_MONTHLY_MIN - (opts.monthlyMinutesUsed ?? 0),
    );
    const remainingLabel = t.minutesRemaining.replace(
      "{count}",
      String(remaining),
    );
    btn.innerHTML += `<span style="font-size:10px;opacity:0.7">${remainingLabel}</span>`;
  }

  btn.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: "OPEN_VOICE_CALL",
      videoId: opts.videoId,
      videoTitle: opts.videoTitle,
      plan: opts.plan, // [N3] propagation pour PostHog voice_call_started.
    });
  });

  root.appendChild(btn);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 👁️ VISUAL ANALYSIS BADGE — Phase 2 (Mai 2026)
// ═══════════════════════════════════════════════════════════════════════════════

export interface VisualAnalysisBadgeOpts {
  plan: "free" | "pro" | "expert";
  videoId?: string;
}

/**
 * Injecte un badge "👁️ Analyse visuelle" sous le bouton Voice Call.
 *
 * Pro/Expert  : badge violet "Inclus" → click ouvre le sidepanel (CTA info)
 * Free        : badge cliquable "Disponible dès Pro" → click ouvre billing
 *
 * Indépendant du bouton Voice Call — cohabite dans le même host Shadow DOM
 * mais ne dépend pas de son état.
 */
export async function renderVisualAnalysisBadge(
  root: HTMLElement,
  opts: VisualAnalysisBadgeOpts,
): Promise<void> {
  const isPaid = opts.plan === "pro" || opts.plan === "expert";

  const badge = document.createElement("button");
  badge.className = "ds-visual-badge";
  badge.setAttribute(
    "aria-label",
    isPaid
      ? "Analyse visuelle incluse dans votre plan"
      : "Analyse visuelle disponible dès Pro",
  );

  const bg = isPaid
    ? "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(99,102,241,0.15))"
    : "rgba(255,255,255,0.05)";
  const borderColor = isPaid
    ? "rgba(139,92,246,0.4)"
    : "rgba(255,255,255,0.15)";

  badge.style.cssText = [
    "width:100%",
    `background:${bg}`,
    "color:#fff",
    `border:1px solid ${borderColor}`,
    "padding:8px 10px",
    "border-radius:8px",
    "font-weight:500",
    "font-size:11px",
    "margin-top:6px",
    "cursor:pointer",
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "gap:8px",
    "transition:opacity 0.15s ease",
  ].join(";");

  const labelText = isPaid
    ? "👁️ Analyse visuelle incluse"
    : "👁️ Analyse visuelle";
  const tagText = isPaid ? "Inclus" : "Pro+";
  const tagBg = isPaid ? "rgba(34,197,94,0.2)" : "rgba(139,92,246,0.25)";
  const tagColor = isPaid ? "#86efac" : "#c4b5fd";

  badge.innerHTML = `
    <span style="display:flex;align-items:center;gap:6px">
      <span>${labelText}</span>
    </span>
    <span style="background:${tagBg};color:${tagColor};padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600;letter-spacing:0.3px;text-transform:uppercase">${tagText}</span>
  `;

  badge.addEventListener("mouseenter", () => {
    badge.style.opacity = "0.85";
  });
  badge.addEventListener("mouseleave", () => {
    badge.style.opacity = "1";
  });

  badge.addEventListener("click", () => {
    chrome.runtime.sendMessage({
      type: isPaid ? "OPEN_SIDEPANEL_VISUAL" : "OPEN_BILLING_UPSELL",
      videoId: opts.videoId,
      feature: "visual_analysis",
      plan: opts.plan,
    });
  });

  root.appendChild(badge);
}
