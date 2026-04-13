---
description: "Conventions et règles obligatoires pour l'Extension Chrome DeepSight (Manifest V3). TOUJOURS consulter cette skill avant d'écrire du code pour l'extension."
---

# Extension Chrome DeepSight — Manifest V3

## Architecture

```
extension/
├── manifest.json
├── src/
│   ├── background/service-worker.ts
│   ├── content/content.ts
│   ├── popup/popup.html, popup.ts, popup.css
│   └── utils/api.ts, auth.ts
└── dist/
```

## Contextes et restrictions

| Contexte       | Accès                    | Restriction                         |
| -------------- | ------------------------ | ----------------------------------- |
| Service Worker | chrome.\* APIs, fetch()  | Pas de DOM, s'endort                |
| Content Script | DOM page, chrome.runtime | chrome.\* limité, pas fetch backend |
| Popup          | DOM propre, chrome.\*    | S'efface si clic ailleurs           |

**Règle critique MV3 :** Le service worker s'endort après inactivité. Utiliser `chrome.storage.session` ou `chrome.storage.local`.

## Communication inter-contextes

```typescript
// content.ts → service-worker.ts
const response = await chrome.runtime.sendMessage({
  type: "ANALYZE_VIDEO",
  payload: { videoUrl },
});

// service-worker.ts — réception
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_VIDEO") {
    handleAnalysis(message.payload.videoUrl)
      .then((result) => sendResponse({ data: result }))
      .catch((err) => sendResponse({ error: err.message }));
    return true; // OBLIGATOIRE pour async
  }
});
```

## Authentification — chrome.storage

```typescript
export async function saveAuthToken(token: string): Promise<void> {
  await chrome.storage.local.set({
    deepsight_token: token,
    deepsight_token_expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
}
```

JAMAIS localStorage dans une extension — utiliser chrome.storage.

## Appels API (depuis Popup ou Service Worker uniquement)

```typescript
const API_BASE = "https://api.deepsightsynthesis.com";
export async function analyzeVideo(videoUrl: string): Promise<AnalysisResult> {
  const token = await getAuthToken();
  if (!token) throw new Error("NON_AUTHENTICATED");
  const response = await fetch(`${API_BASE}/api/v1/analyses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ video_url: videoUrl, platform: "extension" }),
  });
  // Handle 401, 403, etc.
}
```

**Interdit dans content.ts :** `fetch()` vers le backend — passer par le service worker.

## Extraction transcript = backend-side

Règle Chrome Store : L'extraction se fait côté backend, pas en injectant du JS dans YouTube.

## Build et packaging

```powershell
cd C:\Users\33667\DeepSight-Main\extension
npm run build
Compress-Archive -Path .\dist\* -DestinationPath .\extension-v2.0.zip
```

## Checklist avant soumission Chrome Web Store

- manifest_version: 3
- Pas de eval() ou inline scripts
- CSP dans manifest.json
- Permissions minimales
- Pas de clés API dans le bundle
- Privacy policy URL

## Erreurs fréquentes MV3

| Erreur                           | Fix                                         |
| -------------------------------- | ------------------------------------------- |
| `Cannot use import statement`    | `"type": "module"` dans manifest background |
| `chrome is not defined`          | Vérifier contexte d'exécution               |
| `Could not establish connection` | Service worker endormi → retry              |
| `Refused to load script`         | Vérifier CSP                                |
| Fetch bloqué content script      | Fetcher depuis service worker               |
