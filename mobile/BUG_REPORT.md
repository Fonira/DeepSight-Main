# 🐛 DeepSight Mobile — Rapport de Bugs (Code Review)

_Date: 28 Février 2026 — Revue statique complète_

---

## 🔴 CRITIQUE (Impact utilisateur direct)

### BUG-001 — `[object Object]` dans les messages d'erreur API

**Fichier:** `src/services/api.ts` ligne 224-229
**Sévérité:** 🔴 Critique
**Impact:** L'utilisateur voit `[object Object]` au lieu d'un message d'erreur lisible

**Cause:** Quand le backend FastAPI renvoie une erreur de validation Pydantic, `errorData.detail` est un **tableau d'objets** (ex: `[{loc: [...], msg: "...", type: "..."}]`). Le code fait :

```typescript
errorData.message || errorData.detail || errorData.error || "Request failed";
```

`errorData.detail` (un Array) est truthy → il est converti en string → `[object Object]`.

**Fix:** Même correction que celle appliquée au frontend web :

```typescript
const detail = errorData.detail;
const message =
  errorData.message ||
  (Array.isArray(detail) ? detail.map((d: any) => d.msg).join(", ") : detail) ||
  errorData.error ||
  "Request failed";
```

---

### BUG-002 — Erreur TypeScript : `activeOpacity` invalide dans StyleSheet

**Fichier:** `src/components/study/VideoStudyCard.tsx` ligne 164
**Sévérité:** 🔴 Critique (bloque le typecheck)
**Impact:** `npm run typecheck` échoue

**Cause:** `activeOpacity` n'est pas une propriété CSS valide dans `ViewStyle`. C'est une prop de `TouchableOpacity`, pas un style.

**Fix:** Supprimer la ligne du StyleSheet :

```diff
  thumbnailContainer: {
    position: 'relative',
    aspectRatio: 16 / 9,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    overflow: 'hidden',
-   activeOpacity: 0.85,
  },
```

---

### BUG-003 — Double timeout sur chaque requête API

**Fichiers:** `src/services/api.ts` + `src/services/RetryService.ts`
**Sévérité:** 🔴 Critique
**Impact:** Les requêtes peuvent être interrompues prématurément. Comportement imprévisible.

**Cause:** `_requestRaw` crée un `AbortController` avec timeout (30s par défaut). Puis `withRetryPreset` enveloppe l'appel dans un `Promise.race` avec son propre timeout (30s aussi). Les deux timers sont en compétition :

- Si le timer RetryService gagne → erreur "Request timeout" (non `AbortError`)
- Si l'AbortController gagne → erreur `AbortError` → RetryService retry (boucle)

**Fix:** Retirer le timeout du `Promise.race` dans RetryService quand l'appelant gère déjà son propre abort, OU centraliser le timeout dans un seul endroit.

---

## 🟠 MAJEUR (UX dégradée / Bug fonctionnel)

### BUG-004 — `loginWithGoogle` — dépendance manquante dans useCallback

**Fichier:** `src/contexts/AuthContext.tsx` ligne 265
**Sévérité:** 🟠 Majeur
**Impact:** Si `loginWithGoogleToken` est recréé, `loginWithGoogle` utilise une closure stale → échec silencieux possible.

**Cause:** `loginWithGoogle` déclare `useCallback(async () => { ... await loginWithGoogleToken(...) }, [])` avec un tableau de dépendances vide, mais utilise `loginWithGoogleToken`.

**Fix:** Ajouter la dépendance :

```typescript
}, [loginWithGoogleToken]);
```

---

### BUG-005 — Stale closure dans `renderItem` de HistoryScreen

**Fichier:** `src/screens/HistoryScreen.tsx` ligne ~306
**Sévérité:** 🟠 Majeur
**Impact:** Après changement de callbacks (navigation, favoris, suppression), la FlatList utilise des handlers obsolètes.

**Cause:** `renderItem` est wrappé dans `useCallback([viewMode])` mais référence `handleVideoPress`, `handleFavoritePress`, `handleDeletePress` sans les inclure dans les dépendances.

**Fix:** Ajouter les handlers dans les dépendances :

```typescript
const renderItem = useCallback((...) => { ... },
  [viewMode, handleVideoPress, handleFavoritePress, handleDeletePress]
);
```

---

### BUG-006 — SSE Streaming chat bypasse le token refresh

**Fichier:** `src/services/api.ts` — `chatApi.sendMessageStream`
**Sévérité:** 🟠 Majeur
**Impact:** Si le token expire pendant un stream, le chat échoue avec 401 sans retry.

**Cause:** Le streaming SSE utilise `fetch()` directement au lieu de passer par `_requestRaw` qui gère le refresh token. L'access token peut expirer pendant un long stream.

**Fix:** Avant de lancer le fetch SSE, appeler `TokenManager.getValidToken()` pour s'assurer que le token est frais, et ajouter une gestion d'erreur 401 qui refresh puis retry une fois.

---

### BUG-007 — `clearCache` ne fait rien

**Fichier:** `src/screens/SettingsScreen.tsx` ligne 244
**Sévérité:** 🟠 Majeur
**Impact:** Le bouton "Vider le cache" donne un haptic feedback de succès mais ne vide rien.

**Cause:** Le handler `onPress` de la confirmation ne fait que :

```typescript
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
```

Il n'appelle jamais `AsyncStorage.clear()` ou une quelconque logique de nettoyage.

**Fix:** Implémenter la logique :

```typescript
onPress: async () => {
  await AsyncStorage.multiRemove([
    'deepsight_history_cache',
    'deepsight_search_cache',
    // ... autres clés de cache
  ]);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
},
```

---

## 🟡 MOYEN (Qualité code / UX mineure)

### BUG-008 — Strings françaises hardcodées (pas i18n)

**Fichiers multiples:**

- `HistoryScreen.tsx` lignes 380, 399, 427, 447 — "vidéo", "Aucune playlist", "Vidéos", "Playlists"
- `DashboardScreen.tsx` ligne ~485 — "Personnaliser"
- `ProfileScreen.tsx` lignes 211, 255, 285, 297 — "MON ABONNEMENT", "Chat (aujourd'hui)", "Gérer mon abonnement", etc.
- `SettingsScreen.tsx` lignes 283-284 — casts `(t.settings as any).factCheckComplete`

**Impact:** Utilisateurs anglais voient du français mélangé dans l'UI.
**Fix:** Migrer vers les clés `t.xxx` du LanguageContext.

---

### BUG-009 — Dead code : `useSessionExpiry` hook vide

**Fichier:** `src/services/TokenManager.ts` lignes 362-365
**Sévérité:** 🟡 Moyen
**Impact:** Code mort, confusion pour les développeurs.

**Fix:** Soit implémenter la logique prévue, soit supprimer le hook.

---

### BUG-010 — Version hardcodée "v1.0.0"

**Fichiers:** `ProfileScreen.tsx` ligne 395, `SettingsScreen.tsx` ligne 296
**Sévérité:** 🟡 Moyen
**Impact:** La version affichée ne sera jamais mise à jour automatiquement.

**Fix:** Lire depuis `expo-constants` :

```typescript
import Constants from "expo-constants";
const version = Constants.expoConfig?.version || "1.0.0";
```

---

### BUG-011 — `UpgradeScreen` — bottomCta transparent bloque le scroll

**Fichier:** `src/screens/UpgradeScreen.tsx` ligne 279
**Sévérité:** 🟡 Moyen
**Impact:** Le CTA en bas a `backgroundColor: 'transparent'` → le texte des plans en dessous est lisible à travers, créant un rendu confus.

**Fix:** Utiliser le background du thème ou un blur :

```typescript
backgroundColor: colors.bgPrimary;
```

---

### BUG-012 — `SettingsScreen` — SectionList rend chaque section N fois

**Fichier:** `src/screens/SettingsScreen.tsx` lignes 318-332
**Sévérité:** 🟡 Moyen
**Impact:** Chaque `renderItem` reçoit un item mais ne rend le groupe complet que si `index === 0`, sinon rend une View vide. Cela crée N-1 Views vides par section.

**Cause:** Pattern anti-SectionList : utiliser `renderItem` pour rendre toute la section au lieu de l'item individuel. Cela gaspille des renders et peut causer des layouts fantômes.

**Fix:** Utiliser `renderSectionHeader` pour la card complète et retourner `null` dans `renderItem`, ou utiliser une `ScrollView` avec des boucles manuelles.

---

### BUG-013 — Navigation `Upgrade` en conflit (Tab + Stack)

**Fichier:** `src/navigation/AppNavigator.tsx`
**Sévérité:** 🟡 Moyen
**Impact:** `Upgrade` existe à la fois comme Tab screen (MainTabs) et Stack screen (MainStack). Un `navigation.navigate('Upgrade')` depuis le Stack pourrait naviguer vers le mauvais screen.

**Fix:** Renommer le Stack screen en `UpgradeModal` ou utiliser un nesting explicite.

---

### BUG-014 — `SmartInputBar` — `Animated.Value` dans `useMemo`

**Fichier:** `src/components/SmartInputBar.tsx` ligne 158
**Sévérité:** 🟡 Moyen
**Impact:** `new Animated.Value(1)` dans `useMemo` est un anti-pattern. Si les dépendances changent, la valeur animée est recréée et l'animation en cours est perdue.

**Fix:** Utiliser `useRef` :

```typescript
const scaleAnim = useRef(new Animated.Value(1)).current;
```

---

## 🟢 MINEUR (Amélioration / Nettoyage)

### BUG-015 — Import `React` en bas de fichier

**Fichier:** `src/services/RetryService.ts` ligne 406
**Impact:** `import React from 'react'` est en bas du fichier, après le hook `useRetryState`. Fonctionne grâce au hoisting mais viole les conventions d'import.

### BUG-016 — `any` types dans api.ts

**Fichier:** `src/services/api.ts` — `factCheck` utilise `any` pour `freshness`
**Impact:** Perte de type safety.

### BUG-017 — `LoginScreen` utilise `t.settings.changePassword` pour "Mot de passe oublié"

**Impact:** Label potentiellement trompeur — "Changer le mot de passe" ≠ "Mot de passe oublié"

### BUG-018 — `AnalysisScreen` — default tab `chat` au lieu de `summary`

**Impact:** L'utilisateur arrive sur le chat au lieu du résumé de l'analyse. Choix UX discutable.

---

## 📊 Résumé

| Sévérité    | Count  | Priorité fix        |
| ----------- | ------ | ------------------- |
| 🔴 Critique | 3      | Immédiat            |
| 🟠 Majeur   | 4      | Sprint courant      |
| 🟡 Moyen    | 7      | Backlog prioritaire |
| 🟢 Mineur   | 4      | Backlog             |
| **Total**   | **18** |                     |

---

_Rapport généré par code review statique — pas de tests runtime (Expo Web non testé)._
_Fichiers analysés : api.ts, AuthContext.tsx, DashboardScreen.tsx, LoginScreen.tsx, AnalysisScreen.tsx, HistoryScreen.tsx, TokenManager.ts, RetryService.ts, ProfileScreen.tsx, SettingsScreen.tsx, UpgradeScreen.tsx, SmartInputBar.tsx, AppNavigator.tsx, usePlan.ts, useNetworkStatus.ts, types/index.ts, VideoStudyCard.tsx_
