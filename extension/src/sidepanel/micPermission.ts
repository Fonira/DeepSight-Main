/**
 * Accès au micro avant un appel vocal.
 *
 * Dans le panneau latéral, getUserMedia n'affiche pas toujours la demande
 * d'autorisation de Chrome (chromium #41497129) : le SDK ElevenLabs échouait
 * alors en NotAllowedError sans que rien ne s'affiche. On vérifie donc la
 * permission avant de créer la session. Si elle n'est pas encore accordée,
 * le service worker ouvre mic-permission.html, une vraie fenêtre où la
 * demande de Chrome s'affiche, et on attend sa réponse. Une fois accordée à
 * chrome-extension://<id>, le panneau réutilise la permission sans redemander.
 */

export type MicPermissionOutcome = "granted" | "denied" | "dismissed";

/** Messages envoyés par mic-permission.ts (et relayés par le service worker). */
const GRANTED_ACTIONS = new Set([
  "MIC_PERMISSION_GRANTED",
  "MIC_PERMISSION_GRANTED_BROADCAST",
]);
const DISMISSED_ACTION = "MIC_PERMISSION_DISMISSED";

/** Temps laissé pour cliquer dans la fenêtre puis sur « Autoriser ». */
export const MIC_PERMISSION_TIMEOUT_MS = 120_000;

async function readMicPermission(): Promise<PermissionStatus | null> {
  try {
    return await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
  } catch {
    return null; // API absente : on passe par la fenêtre, qui saura répondre
  }
}

export async function ensureMicPermission(
  timeoutMs: number = MIC_PERMISSION_TIMEOUT_MS,
): Promise<MicPermissionOutcome> {
  const status = await readMicPermission();
  if (status?.state === "granted") return "granted";
  // Bloqué par l'utilisateur : Chrome ne redemandera pas, la fenêtre non plus.
  if (status?.state === "denied") return "denied";

  return new Promise<MicPermissionOutcome>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onMessage = (message: unknown): void => {
      const action = (message as { action?: unknown } | null)?.action;
      if (typeof action !== "string") return;
      if (GRANTED_ACTIONS.has(action)) finish("granted");
      else if (action === DISMISSED_ACTION) finish("dismissed");
    };

    function finish(outcome: MicPermissionOutcome): void {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      chrome.runtime.onMessage.removeListener(onMessage);
      if (status) status.onchange = null;
      resolve(outcome);
    }

    timer = setTimeout(() => finish("dismissed"), timeoutMs);
    chrome.runtime.onMessage.addListener(onMessage);
    if (status) {
      status.onchange = () => {
        if (status.state === "granted") finish("granted");
        else if (status.state === "denied") finish("denied");
      };
    }

    Promise.resolve(
      chrome.runtime.sendMessage({ action: "OPEN_MIC_PERMISSION_POPUP" }),
    )
      .then((response: unknown) => {
        if ((response as { success?: boolean } | undefined)?.success === false)
          finish("dismissed");
      })
      .catch(() => finish("dismissed"));
  });
}
