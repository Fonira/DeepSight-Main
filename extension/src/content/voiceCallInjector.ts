// extension/src/content/voiceCallInjector.ts
//
// Injecte le bouton "🎙️ Appeler la vidéo" sur les pages YouTube /watch.
//
// Stratégie :
//  1. Demande au background l'état utilisateur ({ plan, trialUsed,
//     monthlyMinutesUsed }). Si pas authentifié → on n'injecte rien (silent).
//  2. Cherche un anchor stable dans le DOM YouTube
//     (#secondary #related → #below #meta → fallback floating).
//  3. Crée un host `<div id="ds-voice-call-host">` avec un Shadow DOM closed
//     pour isoler nos styles, puis y injecte `renderVoiceCallButton`.
//  4. Idempotent : si le host existe déjà, on no-op.
//  5. Cleanup explicite via `removeVoiceCallButton()` (appelé sur SPA
//     navigation hors /watch).
//
// Pas de dépendance externe — `renderVoiceCallButton` est notre source de
// vérité unique pour le rendu et l'envoi du message OPEN_VOICE_CALL.
import { renderVoiceCallButton } from "./widget";

const HOST_ID = "ds-voice-call-host";

interface VoiceButtonState {
  plan: "free" | "pro" | "expert";
  trialUsed: boolean;
  monthlyMinutesUsed: number;
}

interface MessageResponseShape {
  success?: boolean;
  authenticated?: boolean;
  state?: VoiceButtonState;
  error?: string;
}

/**
 * Cherche un container stable dans le DOM YouTube watch page. Tente plusieurs
 * sélecteurs dans l'ordre de stabilité décroissante. Renvoie null si rien
 * trouvé (l'appelant utilisera alors un overlay fixed).
 */
function findYouTubeAnchor(): HTMLElement | null {
  const candidates = [
    "#secondary #related",
    "#secondary",
    "#below #meta",
    "#below",
  ];
  for (const sel of candidates) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

/**
 * Crée le host DOM et son Shadow root, puis applique le style approprié
 * selon qu'on est en anchor inline ou en floating overlay.
 */
function createHost(useFloating: boolean): {
  host: HTMLElement;
  shadow: ShadowRoot;
} {
  const host = document.createElement("div");
  host.id = HOST_ID;
  if (useFloating) {
    host.style.cssText = [
      "position:fixed",
      "bottom:80px",
      "right:20px",
      "z-index:9999",
      "width:280px",
    ].join(";");
  } else {
    host.style.cssText = [
      "margin:0 0 12px 0",
      "padding:0",
      "width:100%",
      "max-width:402px",
    ].join(";");
  }
  const shadow = host.attachShadow({ mode: "closed" });
  return { host, shadow };
}

/**
 * Récupère l'état utilisateur depuis le background. Si non authentifié ou
 * erreur, renvoie null (pas d'injection).
 */
async function fetchVoiceButtonState(): Promise<VoiceButtonState | null> {
  try {
    const response = (await chrome.runtime.sendMessage({
      action: "GET_VOICE_BUTTON_STATE",
    })) as MessageResponseShape | undefined;
    if (!response || !response.success || !response.state) return null;
    return response.state;
  } catch {
    return null;
  }
}

/**
 * Extrait le video ID YouTube depuis l'URL courante (/watch?v=…).
 */
function extractWatchVideoId(): string | null {
  try {
    const url = new URL(location.href);
    if (url.pathname !== "/watch") return null;
    return url.searchParams.get("v");
  } catch {
    return null;
  }
}

/**
 * Injecte le bouton 🎙️ sur la page YouTube watch. Idempotent : si déjà
 * présent on no-op. Silencieux si pas authentifié.
 */
export async function injectVoiceCallButton(): Promise<void> {
  // Idempotence : un seul host à la fois.
  if (document.getElementById(HOST_ID)) return;

  const videoId = extractWatchVideoId();
  if (!videoId) return;

  const state = await fetchVoiceButtonState();
  if (!state) return;

  // Re-check idempotence après l'await — un autre call concurrent peut avoir
  // injecté entretemps.
  if (document.getElementById(HOST_ID)) return;

  const anchor = findYouTubeAnchor();
  const useFloating = anchor === null;
  const { host, shadow } = createHost(useFloating);

  // attachShadow renvoie un ShadowRoot ; renderVoiceCallButton accepte un
  // HTMLElement (DOM node avec appendChild). Cast minimaliste — on ne triche
  // pas sur la sémantique runtime.
  await renderVoiceCallButton(shadow as unknown as HTMLElement, {
    plan: state.plan,
    trialUsed: state.trialUsed,
    monthlyMinutesUsed: state.monthlyMinutesUsed,
    videoId,
    videoTitle: document.title,
  });

  if (useFloating) {
    document.body.appendChild(host);
  } else {
    // Insère en haut du container pour rester visible sans scroll.
    anchor!.insertBefore(host, anchor!.firstChild);
  }
}

/**
 * Retire le bouton de la page si présent. Safe à appeler même si rien
 * n'est injecté.
 */
export function removeVoiceCallButton(): void {
  const host = document.getElementById(HOST_ID);
  if (host?.parentNode) {
    host.parentNode.removeChild(host);
  }
}
