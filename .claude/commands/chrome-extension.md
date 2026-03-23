---
allowed-tools: Read, Edit, Write, Grep, Glob
description: Extension Chrome DeepSight — Manifest V3, service worker, content scripts, auth
---

# Extension Chrome DeepSight

Implémenter / modifier : $ARGUMENTS

## Architecture : manifest.json + src/{background/service-worker.ts, content/content.ts, popup/*, utils/{api,auth}.ts}

## Contextes MV3
- Service Worker : chrome.* APIs, fetch() → PAS de DOM, S'ENDORT après inactivité
- Content Script : DOM page → PAS de fetch backend (passer par sendMessage)
- Popup : DOM propre, chrome.* → S'efface si clic ailleurs

## Communication : `chrome.runtime.sendMessage({type, payload})` + `return true` pour async

## Auth : JAMAIS localStorage → `chrome.storage.local` pour tokens

## API calls : UNIQUEMENT depuis Popup ou Service Worker
```typescript
const response = await fetch(`${API_BASE}/api/v1/...`, {
  headers: { 'Authorization': `Bearer ${token}` }
})
```

## Transcript : extraction BACKEND-SIDE uniquement (règle Chrome Store)

## Build : `npm run build` → `Compress-Archive -Path .\dist\* -DestinationPath .\extension.zip`

## Checklist Store : MV3, pas eval(), CSP dans manifest, permissions minimales, pas de clés API dans bundle

## Erreurs courantes : import module → `"type": "module"`, service worker endormi → retry, fetch content script → passer par SW