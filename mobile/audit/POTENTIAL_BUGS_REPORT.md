# DeepSight Mobile — Rapport des bugs potentiels

**Date :** 2026-01-28  
**Périmètre :** `mobile/src` (Expo SDK 54, React Native)

---

## Priorité haute

### 1. **API `request` — pas de timeout sur les requêtes 401 retry**

**Fichier :** `src/services/api.ts`  
**Lignes :** 134–190 (bloc 401)  

Lors d’un 401, après refresh du token, la requête est relancée avec `fetch(..., requestOptions)`.  
`requestOptions` contient encore l’ancien `signal` (déjà consommé) et **aucun nouveau `AbortController`/timeout** n’est créé pour le retry. Une requête de retry ou un subscriber peut donc rester bloquée indéfiniment.

**Recommandation :**  
Créer un nouvel `AbortController` + `setTimeout` pour chaque retry et le passer au `fetch` de retry (et aux `fetch` des `addRefreshSubscriber`).

---

### 2. **AnalysisScreen — `loadInitialData` après unmount**

**Fichier :** `src/screens/AnalysisScreen.tsx`  
**Lignes :** 232–264  

Quand ce n’est **pas** une tâche de `BackgroundAnalysisContext`, `loadInitialData()` est lancé sans `AbortController` ni garde `isMountedRef`.  
Si l’utilisateur quitte l’écran avant la fin de `getStatus` / `loadCompletedAnalysis`, les `setState` (setSummary, setError, setIsLoading, etc.) s’exécutent sur un composant déjà démonté → risque de warning React et comportement instable.

**Recommandation :**  
- Vérifier `isMountedRef.current` avant chaque `setState` dans `loadInitialData` et `loadCompletedAnalysis`,  
- ou annuler la requête au cleanup (ex. `AbortController` + `fetch(..., { signal })` si l’API le permet).

---

### 3. **AnalysisScreen — `!summaryId` → chargement infini**

**Fichier :** `src/screens/AnalysisScreen.tsx`  
**Lignes :** 176–179  

```ts
if (!summaryId) return;
// ...
setIsLoading(true);
```

Si `Analysis` est ouvert **sans** `summaryId` ni `videoUrl` (deep link, bug de navigation), l’effet fait `setIsLoading(true)` puis `return` sans jamais `setIsLoading(false)` ni `setError`.  
L’écran reste bloqué sur le loader (`isLoading && analysisProgress < 100`).

**Recommandation :**  
En cas de `!summaryId` (et éventuellement `!videoUrl` si on ne gère pas ce cas) :  
- `setError(t.errors.generic)` ou message dédié,  
- `setIsLoading(false)`,  
- et éventuellement `navigation.goBack()` ou affichage d’un message + bouton « Retour ».

---

### 4. **useAnalysisStream — `resume()` écrase le statut `complete`**

**Fichier :** `src/hooks/useAnalysisStream.ts`  
**Lignes :** 392–402  

Dans `resume()`, après traitement du `pauseBufferRef`, on appelle toujours `setStatus('analyzing')`.  
Si le buffer contenait un événement `complete`, `handleEvent` aura déjà fait `setState(..., status: 'complete')`.  
Comme `setState` est asynchrone, `setStatus('analyzing')` peut s’exécuter **après** et remettre le statut en `analyzing` au lieu de `complete`.

**Recommandation :**  
Ne pas appeler `setStatus('analyzing')` systématiquement après le buffer.  
Soit :  
- ne pas changer le statut si `handleEvent` a déjà mis `complete`/`error` (ex. en vérifiant l’état ou un flag),  
- soit ne plus appeler `setStatus` dans `resume` et laisser `handleEvent` gérer tout le statut.

---

### 5. **useAnalysisStream — `metadataRef.current!` peut être `null`**

**Fichier :** `src/hooks/useAnalysisStream.ts`  
**Lignes :** 286–291  

Dans le `case 'complete'`, on appelle :

```ts
onComplete?.({
  summaryId: data.summary_id,
  text: textBufferRef.current,
  metadata: metadataRef.current!,
});
```

Si un événement `complete` arrive **avant** `metadata` (race, bug serveur), `metadataRef.current` peut rester `null`.  
Le `!` force TypeScript à le traiter comme non-null → risque de crash ou de `metadata: null` dans `onComplete`.

**Recommandation :**  
- Soit garder `metadata: metadataRef.current ?? null` et adapter le type de `onComplete` pour accepter `metadata: VideoMetadata | null`,  
- soit ne pas appeler `onComplete` si `!metadataRef.current` (selon la sémantique métier).

---

## Priorité moyenne

### 6. **API — `userApi.uploadAvatar` sans timeout ni refresh 401**

**Fichier :** `src/services/api.ts`  
**Lignes :** 349–384  

`uploadAvatar` utilise un `fetch` direct, sans :  
- `AbortController` / `setTimeout` (timeout),  
- gestion 401 / `refreshAccessToken` et retry.

En cas de token expiré ou de requête lente, l’utilisateur peut rester sans retour.

**Recommandation :**  
Réutiliser la logique de `request` (timeout + 401 + retry) ou une helper dédiée pour les `multipart`, en conservant `FormData` et sans fixer `Content-Type` (boundary).

---

### 7. **API — `chatApi.sendMessageStream` sans timeout ni 401**

**Fichier :** `src/services/api.ts`  
**Lignes :** 723–775  

Le `fetch` du stream n’a pas de timeout ni de gestion 401.  
En réseau lent ou token expiré, la promise peut ne jamais se résoudre, et aucune reconnexion après refresh.

**Recommandation :**  
- Timeout via `AbortController` + `setTimeout` (en gardant le `reader` utilisable tant que la requête n’est pas annulée).  
- En 401 : refresh puis retry du `fetch` (si le flux le permet) ou erreur claire.

---

### 8. **API — `exportApi.exportSummary` sans timeout sur le `fetch`**

**Fichier :** `src/services/api.ts`  
**Lignes :** 909–934  

Le `fetch` et le `blob()` n’ont pas de limite de temps.  
Export lourd + réseau lent = attente illimitée.

**Recommandation :**  
Utiliser un `AbortController` + `setTimeout` (ex. `TIMEOUTS.DEFAULT` ou `FACT_CHECK`) et `fetch(..., { signal })`.

---

### 9. **api.ts — `getSummary` : `console.log` en prod**

**Fichier :** `src/services/api.ts`  
**Lignes :** 412–419  

```ts
console.log('[API] getSummary response:', { ... });
```

Log systématique des réponses. À réserver au debug.

**Recommandation :**  
Supprimer ou entourer avec `if (__DEV__) { console.log(...) }`.

---

### 10. **AuthContext — `init` : setState possible après unmount**

**Fichier :** `src/contexts/AuthContext.tsx`  
**Lignes :** 89–144  

`init` est asynchrone. Si `AuthProvider` est démonté avant la fin (peu fréquent mais possible), `setUser`, `setIsLoading`, `tokenStorage.clearTokens`, etc. peuvent encore s’exécuter.

**Recommandation :**  
Utiliser un `isMountedRef` (ou un flag) et ne plus appeler `setUser` / `setIsLoading` / `completeInit` si le composant est démonté.  
Bien nettoyer le flag dans le `return` du `useEffect`.

---

### 11. **AuthContext — `loginWithGoogle` : `err: any`**

**Fichier :** `src/contexts/AuthContext.tsx`  
**Ligne :** 202  

```ts
} catch (err: any) {
```

Usage de `any` alors que les règles Expo/TS imposent d’éviter `any`.

**Recommandation :**  
`catch (err: unknown)` et faire `err instanceof Error`, `'code' in err`, etc. pour accéder à `err.code` de façon typée.

---

### 12. **AnalysisScreen — `(summary as any)` et `(f: any)`**

**Fichier :** `src/screens/AnalysisScreen.tsx`  

- Lignes 431–434 : `(summary as any).notes`, `(summary as any).tags`  
- Ligne 290 : `(f: any)` dans `loadReliabilityData`  
- Ligne 601 : `(summary as any).creditsUsed`  

Ça contourne le typage et peut masquer des erreurs.

**Recommandation :**  
- Étendre `AnalysisSummary` (ou un type dérivé) avec `notes?`, `tags?`, `creditsUsed?` si l’API les fournit.  
- Typer le paramètre de `map` dans `loadReliabilityData` (ex. `{ name: string; score: number; description: string }`).

---

### 13. **Dashboard — `analysisRequest: any`**

**Fichier :** `src/screens/DashboardScreen.tsx`  
**Ligne :** 148  

```ts
const analysisRequest: any = { ... };
```

**Recommandation :**  
Utiliser `AnalysisRequest` (ou un type dérivé) et adapter les champs (`raw_text`, `title`, `source`) si besoin.

---

## Priorité basse / conventions

### 14. **Config — secrets en dur**

**Fichier :** `src/constants/config.ts`  

`API_BASE_URL`, `GOOGLE_CLIENT_ID`, etc. sont en dur.  
Les règles projet indiquent : pas de secrets en dur ; `.env` ou `constants/config` (avec variables d’environnement).

**Recommandation :**  
Utiliser `expo-constants` (`.extra`) ou `process.env` / `import.meta` selon la config Expo, et documenter les clés attendues (`.env.example`).

---

### 15. **PlaylistsScreen — `navigate('Analysis', { summaryId: result.task_id })`**

**Fichier :** `src/screens/PlaylistsScreen.tsx`  
**Ligne :** 181  

Ici `summaryId` reçoit un `task_id` d’**analyse de playlist**.  
`AnalysisScreen` appelle `videoApi.getStatus(task_id)` (orienté tâche **vidéo**) puis, en fallback, `loadCompletedAnalysis(task_id)`, qui attend un **résumé** (id de summary), pas un task_id de playlist.

**Risque :**  
Comportement incohérent ou erreur si l’API ne gère pas un `task_id` de playlist comme une tâche vidéo.

**Recommandation :**  
Clarifier le flux :  
- soit l’écran Analysis ne doit pas être utilisé pour une tâche de playlist (autre écran ou autre route),  
- soit le backend fournit un `summary_id` ou un mapping explicite et on navigue avec celui-ci.

---

### 16. **Haptics sur web**

**Fichiers :** `AppNavigator`, `FloatingChat`, `AnalysisScreen`, etc.  

`expo-haptics` est appelé sans vérifier la plateforme. Sur **web**, il peut être indisponible ou sans effet.

**Recommandation :**  
Soit `if (Platform.OS !== 'web') Haptics.impactAsync(...)`, soit un wrapper `safeHaptics` qui no-op sur web.

---

### 17. **useAnalysisStream — retry `setTimeout` sans annulation**

**Fichier :** `src/hooks/useAnalysisStream.ts`  
**Lignes :** 318–319  

En erreur, on fait :

```ts
setTimeout(() => start(), 1000 * Math.pow(2, retryCountRef.current));
```

Si le composant est démonté ou que `cancel()` est appelé avant l’échéance, le `setTimeout` va quand même rappeler `start()`.

**Recommandation :**  
Stocker l’id du `setTimeout` dans une ref et le `clearTimeout` dans le cleanup du `useEffect` et dans `cancel` / `reset`.

---

## Résumé des actions recommandées

| Priorité | #  | Action |
|----------|----|--------|
| Haute    | 1  | Timeout + nouvel AbortController sur les retry 401 dans `api.request` |
| Haute    | 2  | Guard `isMountedRef` (ou abort) dans `loadInitialData` / `loadCompletedAnalysis` |
| Haute    | 3  | Gérer `!summaryId` : error + `setIsLoading(false)` (et évent. `goBack`) |
| Haute    | 4  | Corriger `resume()` pour ne pas écraser `status: 'complete'` |
| Haute    | 5  | Remplacer `metadataRef.current!` par un usage null-safe dans `onComplete` |
| Moyenne  | 6  | Timeout + 401 pour `uploadAvatar` |
| Moyenne  | 7  | Timeout + 401 pour `sendMessageStream` |
| Moyenne  | 8  | Timeout pour `exportSummary` |
| Moyenne  | 9  | Retirer ou `__DEV__` le `console.log` dans `getSummary` |
| Moyenne  | 10 | Guard unmount dans `AuthContext.init` |
| Moyenne  | 11 | Remplacer `err: any` par `unknown` + type guards dans `loginWithGoogle` |
| Moyenne  | 12 | Remplacer les `(summary as any)` / `(f: any)` par des types adaptés |
| Moyenne  | 13 | Typage de `analysisRequest` dans Dashboard |
| Basse    | 14 | Externaliser les secrets (config / .env) |
| Basse    | 15 | Revoir la navigation Playlists → Analysis (`task_id` vs `summary_id`) |
| Basse    | 16 | Guard ou wrapper pour Haptics sur web |
| Basse    | 17 | `clearTimeout` du retry dans `useAnalysisStream` (cleanup / cancel) |

---

*Rapport généré par audit statique du code source. Les correctifs proposés sont à valider par des tests et une revue.*
