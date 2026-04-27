// extension/src/offscreen-mic.ts
//
// Offscreen document — solution officielle Chrome MV3 pour appeler
// `navigator.mediaDevices.getUserMedia({audio:true})` en bypassant le bug
// connu où les extension pages (sidepanel/popup) ne déclenchent pas le
// prompt natif Chrome de façon fiable.
//
// Flow :
//   1. VoiceView envoie `{action:"REQUEST_MIC_PERMISSION"}` au background SW
//   2. background SW s'assure que ce document offscreen existe
//      (`chrome.offscreen.createDocument` avec reasons:["USER_MEDIA"])
//   3. background SW lui envoie `{target:"offscreen-mic", action:"REQUEST_MIC"}`
//   4. ce script appelle getUserMedia → renvoie {granted, errorName?}
//   5. Chrome cache la permission pour `chrome-extension://<id>` → les
//      futurs getUserMedia (depuis le SDK ElevenLabs côté sidepanel) la
//      réutilisent sans re-prompt.

interface MicRequestMessage {
  target?: string;
  action?: string;
}

interface MicResponse {
  granted: boolean;
  errorName?: string;
  errorMessage?: string;
}

chrome.runtime.onMessage.addListener(
  (
    message: MicRequestMessage,
    _sender,
    sendResponse: (response: MicResponse) => void,
  ) => {
    if (message?.target !== "offscreen-mic") return false;
    if (message?.action !== "REQUEST_MIC") return false;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        // Release immédiat — Chrome cache la permission, le SDK pourra
        // re-getUserMedia côté sidepanel sans re-prompt.
        for (const track of stream.getTracks()) track.stop();
        sendResponse({ granted: true });
      } catch (err) {
        const e = err as Error;
        sendResponse({
          granted: false,
          errorName: e.name,
          errorMessage: e.message,
        });
      }
    })();

    // Keep message channel open pour le sendResponse async.
    return true;
  },
);
