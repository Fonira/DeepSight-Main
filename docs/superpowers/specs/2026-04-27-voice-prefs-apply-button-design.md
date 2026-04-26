# Voice Prefs Apply Button — Design Spec

**Date** : 2026-04-27
**Auteur** : Maxime (DeepSight)
**Statut** : Draft v1
**Périmètre** : DeepSight Web (`frontend/`)

---

## 1. Problème

Aujourd'hui, dans le hub Chat IA voice (`/chat`) et la page de paramètres vocaux, chaque modification de préférence ElevenLabs (sélection de voix, vitesse, modèle, stability, etc.) déclenche un `voiceApi.updatePreferences()` immédiat. Mais :

- La plupart des champs sont **bakés à `startSession`** côté SDK ElevenLabs — ils ne s'appliquent qu'à la prochaine session.
- Pendant un appel actif, changer la voix ne fait rien d'audible — l'utilisateur croit que c'est cassé.
- Le seul mécanisme existant (`restart_required` event + banner amber dans `VoiceModal`) demande à l'utilisateur de cliquer un bouton "Redémarrer" caché dans le panneau de paramètres, qui n'est même pas câblé dans le `VoiceOverlay` du hub Chat.
- Plusieurs modifications successives = plusieurs round-trips backend isolés au lieu d'un batch.

L'utilisateur attend un comportement de type "form Apply" : tweaker plusieurs paramètres puis valider d'un coup, avec application immédiate (incluant restart de la session si nécessaire).

## 2. Objectifs

1. **Application immédiate** : à l'Apply, les nouveaux paramètres affectent la session ElevenLabs en cours (restart silencieux ~1-2s si nécessaire).
2. **Batch** : un seul appel backend par Apply, peu importe le nombre de champs modifiés.
3. **Cohérence inter-UI** : même flow dans `VoiceLiveSettings` (panneau in-call) et `VoiceSettings` (page complète).
4. **Préserver le live feedback** des contrôles où c'est attendu (volume, playback rate ≤ 1x).
5. **Réversibilité** : possibilité d'annuler les changements en attente avant Apply.

## 3. Non-objectifs (V1)

- Persistance des changements stagés à travers reloads/onglets.
- Synchronisation multi-onglets.
- Diff visuel détaillé (avant/après) dans la toolbar — un compteur suffit.
- Mobile (`mobile/`) et extension Chrome — V2.

## 4. Décisions de design (validées)

| ID  | Décision                         | Choix retenu                                                                                    |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------- |
| D1  | Périmètre UI                     | Les deux : `VoiceLiveSettings` + `VoiceSettings`                                                |
| D2  | Comportement pendant appel actif | Restart silencieux automatique (~1-2s coupure, contexte agent réinitialisé)                     |
| D3  | Granularité du staging           | Hybride : volume + playback_rate restent live ; tout le reste est stagé                         |
| D4  | UX du bouton                     | Toolbar flottante avec compteur + Apply + Annuler, conditionnelle (visible ssi changes pending) |

## 5. Architecture

```
App.tsx
└─ <VoicePrefsStagingProvider>             ← NEW (root, always mounted)
   ├─ state: applied, staged, callActive, applying, applyError
   ├─ actions: stage(), cancel(), apply()
   │
   ├─ <ChatPage>
   │  └─ <VoiceOverlay>
   │     ├─ useVoiceChat
   │     │   ├─ publishes bus event `call_status_changed`
   │     │   └─ subscribes to bus event `apply_with_restart` → restart()
   │     └─ <VoiceLiveSettings>            ← stage() au lieu de save()
   │
   ├─ <VoiceModal>
   │  └─ <VoiceSettings compact>           ← stage() au lieu de savePreferences()
   │
   ├─ /settings/voice (page standalone)
   │  └─ <VoiceSettings>                   ← idem
   │
   └─ <StagedPrefsToolbar />               ← NEW, render conditionnel global
```

### Source de vérité

Le provider tient deux états :

- `applied: VoicePreferences | null` — dernière version persistée backend (vérité).
- `staged: Partial<VoicePreferences>` — delta non encore appliqué.

Les UI lisent les valeurs comme `{ ...applied, ...staged }` pour l'affichage (overlay du diff). L'écriture passe toujours par `stage()`.

### Communication avec `useVoiceChat`

Extension de `voicePrefsBus` avec deux nouveaux events :

| Event                 | Sens            | Charge utile          | Rôle                                                   |
| --------------------- | --------------- | --------------------- | ------------------------------------------------------ |
| `apply_with_restart`  | provider → hook | —                     | « Persistance OK, restart la session si tu es active » |
| `call_status_changed` | hook → provider | `{ active: boolean }` | Adapte le label du bouton Apply                        |

Les events legacy `playback_rate_changed` et `restart_required` sont conservés pour ne pas casser le code existant ; le banner `restart_required` dans `VoiceModal` est supprimé au profit de la toolbar globale.

## 6. Catégorisation des champs

Une constante `restartRequiredFields.ts` centralise la classification :

| Catégorie      | Champs                                                                                                                                                                                                    | Comportement                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Live**       | `volume` (DOM only, jamais persisté) ; `playback_rate` (toute valeur) — déjà live-applicable via `voicePrefsBus` + `<audio>.playbackRate`                                                                 | Pas de stage. Save direct + emit `playback_rate_changed`.       |
| **Stagé soft** | `voice_chat_speed_preset` (variantes non-concises), `ptt_key`, `input_mode`, `turn_timeout`, `soft_timeout_seconds`                                                                                       | `stage()`. À Apply : save backend uniquement.                   |
| **Stagé hard** | `voice_id`, `voice_name`, `tts_model`, `voice_chat_model`, `stability`, `similarity_boost`, `style`, `use_speaker_boost`, `language`, `gender`, `voice_chat_speed_preset` (variantes concises uniquement) | `stage()`. À Apply : save backend + `restart()` si appel actif. |

Helper exposé : `isRestartRequired(updates: Partial<VoicePreferences>): boolean`.

## 7. API du provider

```ts
interface VoicePrefsStagingContextValue {
  applied: VoicePreferences | null;
  staged: Partial<VoicePreferences>;
  hasChanges: boolean;
  hasRestartRequired: boolean;
  callActive: boolean;
  applying: boolean;
  applyError: string | null;

  stage: (updates: Partial<VoicePreferences>) => void;
  cancel: () => void;
  apply: () => Promise<void>;
}

export function useVoicePrefsStaging(): VoicePrefsStagingContextValue;
```

### Sémantique des actions

- `stage(updates)` : merge dans `staged`. Pour chaque clé dont la valeur revient à `applied[key]`, retire la clé (no-op auto-detect → `hasChanges` reflète la réalité).
- `cancel()` : `setStaged({})`. Idempotent.
- `apply()` :
  1. `setApplying(true)`
  2. `next = await voiceApi.updatePreferences(staged)` → `setApplied(next)`
  3. Si `hasRestartRequired && callActive` → `emitVoicePrefsEvent({ type: 'apply_with_restart' })`
  4. `setStaged({})`
  5. `setApplying(false)`
  6. Erreur réseau/HTTP → `setApplyError(msg)`, conserver `staged`

### Initial fetch

`useEffect` au mount : `voiceApi.getPreferences()` → `setApplied()`. Spinner global non nécessaire (les UI consommatrices ont déjà leur propre `loading` qu'on peut câbler sur `applied === null`).

## 8. Composants

### 8.1 NEW — `frontend/src/components/voice/staging/VoicePrefsStagingProvider.tsx`

Provider React Context. Souscrit à `voicePrefsBus.call_status_changed` pour `setCallActive`. Implémente la logique d'API ci-dessus.

### 8.2 NEW — `frontend/src/components/voice/staging/StagedPrefsToolbar.tsx`

Toolbar flottante :

- `position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 1100`
- Mount/unmount via `AnimatePresence` selon `hasChanges`
- Layout :
  ```
  ● {N} modifications en attente   [Annuler]   [Appliquer →]
                                                ou
                                   [Appliquer & redémarrer ↻]
  ```
- Variantes label sur le bouton primaire :
  - `callActive && hasRestartRequired` → "Appliquer & redémarrer"
  - sinon → "Appliquer"
- États :
  - `applying === true` → bouton primaire affiche un spinner, Annuler désactivé
  - `applyError !== null` → ligne d'erreur amber sous la toolbar avec bouton Réessayer
- A11y :
  - `role="status"`, `aria-live="polite"` sur le compteur
  - `aria-keyshortcuts="Mod+Enter"` pour Apply
  - Focus sur Apply au mount
- Style : glassmorphism cohérent avec le design system (`bg-[#12121a]/85 backdrop-blur-xl border border-white/10`)

### 8.3 NEW — `frontend/src/components/voice/staging/restartRequiredFields.ts`

```ts
export const RESTART_REQUIRED_FIELDS: ReadonlySet<keyof VoicePreferences> =
  new Set([
    "voice_id",
    "voice_name",
    "tts_model",
    "voice_chat_model",
    "stability",
    "similarity_boost",
    "style",
    "use_speaker_boost",
    "language",
    "gender",
  ]);

export function isRestartRequired(
  updates: Partial<VoicePreferences>,
  speedPresets: VoiceChatSpeedPreset[],
): boolean {
  /* ... handles concise mode for voice_chat_speed_preset */
}
```

### 8.4 MODIFY — `frontend/src/components/voice/voicePrefsBus.ts`

```ts
export type VoicePrefsEvent =
  | { type: "playback_rate_changed"; value: number }
  | { type: "restart_required"; reason: string } // legacy
  | { type: "apply_with_restart" } // NEW
  | { type: "call_status_changed"; active: boolean }; // NEW
```

### 8.5 MODIFY — `frontend/src/components/voice/useVoiceChat.ts`

- Dans `start()` après `onConnect` → emit `call_status_changed: { active: true }`
- Dans `stop()` → emit `call_status_changed: { active: false }`
- Nouveau `useEffect` qui souscrit à `apply_with_restart` :
  ```ts
  if (event.type === "apply_with_restart" && conversationRef.current) {
    void restart();
  }
  ```

### 8.6 MODIFY — `frontend/src/components/voice/VoiceLiveSettings.tsx`

- Lit `applied` et `staged` depuis `useVoicePrefsStaging()`
- Affichage : valeur affichée = `staged[key] ?? applied[key]`
- Indicateur visuel (point violet 6px) sur les contrôles dont la clé est dans `staged`
- Volume : reste inchangé (DOM direct, pas de stage)
- Playback rate : reste inchangé (live emit + persist immédiat — c'est un cas live spécial)
- `input_mode`, `ptt_key`, `language` : `staging.stage({...})` au lieu de `save({...})`

### 8.7 MODIFY — `frontend/src/components/voice/VoiceSettings.tsx`

- Lit `applied` et `staged` depuis `useVoicePrefsStaging()`
- Suppression de l'état local `preferences` et de la fonction `savePreferences()` interne
- Tous les `onSave` / `onClick` qui appelaient `savePreferences({...})` deviennent `staging.stage({...})`
- Le bouton "Réinitialiser les valeurs par défaut" stage les valeurs par défaut (ne save pas)
- Le toast "Préférences enregistrées !" est déplacé dans la toolbar (visible globalement, plus pertinent)

### 8.8 MODIFY — `frontend/src/components/voice/VoiceModal.tsx`

- Suppression du `useState` `restartRequired`, du banner amber, et du `useEffect` qui souscrit à `restart_required`
- Le bouton "Redémarrer" du header reste comme escape hatch manuel
- (La toolbar globale couvre désormais le besoin)

### 8.9 MODIFY — `frontend/src/App.tsx` (ou root équivalent)

```tsx
<VoicePrefsStagingProvider>
  <RouterProvider router={router} />
  <StagedPrefsToolbar />
</VoicePrefsStagingProvider>
```

## 9. Data flow — scénarios

### Scénario A — Hors appel, page Paramètres vocaux

1. User change voix → `stage({ voice_id, voice_name })`
2. User change preset vitesse vers une variante concise → `stage({ voice_chat_speed_preset })` (les variantes concises sont définies côté backend dans `VOICE_CHAT_SPEED_PRESETS`)
3. Toolbar apparaît : "2 modifications • Annuler • Appliquer"
4. Click Apply → `voiceApi.updatePreferences({voice_id, voice_name, voice_chat_speed_preset})` (1 round-trip)
5. `applied` mis à jour, `staged = {}`, toolbar disparaît
6. Pas de restart (pas d'appel actif)

### Scénario B — Pendant un appel, panneau in-call (VoiceOverlay)

1. User ouvre `VoiceLiveSettings`, change langue FR → EN
2. `stage({ language: 'en' })` (langue est dans `RESTART_REQUIRED_FIELDS`)
3. Toolbar : "1 modification • Annuler • Appliquer & redémarrer ↻"
4. Click Apply :
   - save backend OK
   - emit `apply_with_restart`
   - `useVoiceChat` reçoit, appelle `restart()` (stop → 400ms → start)
   - Backend `/api/voice/session` lit les prefs fraîchement persistées et bake l'agent EN
5. ~1.5s coupure audible, l'agent reprend en anglais
6. Le contexte conversationnel précédent est perdu (limitation SDK ElevenLabs documentée)

### Scénario C — Slider volume pendant un appel

1. User bouge le slider volume → DOM `audio.volume` direct, **pas de stage**
2. Toolbar n'apparaît pas
3. Pas de persistance backend (volume est purement client-side)

## 10. Edge cases

| Cas                                         | Réponse                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Apply backend échoue (500/429)              | `applyError` set, `staged` conservé, toolbar montre erreur amber + bouton Réessayer                   |
| Apply pendant qu'un Apply est déjà en cours | `applying === true` → bouton désactivé, idempotent                                                    |
| User ferme l'onglet avec staged non-empty   | Aucune persistance — clear au reload (évite fantômes)                                                 |
| `stage()` avec valeur identique à `applied` | Auto-removal de la clé du staged (no-op detect)                                                       |
| Pref refetch (reload page) pendant staging  | Initial fetch écrase `applied`, `staged` conservé → toolbar à jour                                    |
| Apply réussit mais `restart()` throw        | Toolbar disparaît (save OK), erreur loggée non bloquante, escape hatch via header                     |
| Slider stability bougé en continu           | Chaque drag = un `stage()` ; comme stage merge sur la même clé, pas d'inflation. Toolbar reste stable |
| Multi-onglets simultanés                    | Out of V1. Last-write-wins backend. Acceptable.                                                       |
| User Apply puis change idée immédiat        | `staged = {}` après Apply ; nouveau change = nouveau staged. Le restart précédent est terminé.        |
| Restart pendant que l'agent parle           | `stop()` du SDK ElevenLabs gère le tear-down ; pas de fuite mémoire / audio resté ouvert.             |

## 11. Tests

### Unit (Vitest)

- `VoicePrefsStagingProvider.test.tsx`
  - Initial fetch hydrate `applied`
  - `stage()` accumule dans `staged`
  - `stage()` avec valeur égale à applied retire la clé
  - `cancel()` vide `staged`
  - `apply()` happy path : 1 call backend batch, `applied` mis à jour, `staged` vidé
  - `apply()` avec hasRestartRequired + callActive → bus event émis
  - `apply()` avec hasRestartRequired + !callActive → pas de bus event
  - `apply()` erreur → `applyError` set, `staged` conservé
  - Souscription `call_status_changed` → `callActive` mis à jour
- `StagedPrefsToolbar.test.tsx`
  - Visible ssi `hasChanges`
  - Compteur correct (nombre de clés dans `staged`)
  - Label "Appliquer" vs "Appliquer & redémarrer" selon callActive + hasRestartRequired
  - Click Annuler → `cancel()` appelé
  - Click Apply → `apply()` appelé
  - `applying` → bouton spinner, Annuler désactivé
  - `applyError` → message visible + Réessayer
  - A11y : role status, aria-live polite
- `VoiceLiveSettings.test.tsx`
  - Update existing tests : changer mode/ptt/lang → `stage()` (pas `voiceApi.updatePreferences()`)
  - Volume slider → DOM direct, pas de stage
- `VoiceSettings.test.tsx`
  - Update existing tests : tous les changements → `stage()`
  - Reset defaults → stage les valeurs par défaut (pas save)
- `useVoiceChat.test.ts`
  - Réception `apply_with_restart` pendant call → `restart()` triggered
  - Réception `apply_with_restart` sans call → no-op
  - Publish `call_status_changed` sur start/stop
- `restartRequiredFields.test.ts`
  - `isRestartRequired` retourne true pour chaque champ hard
  - false pour live + soft staged
  - true pour preset concis, false pour preset normal

### E2E (Playwright)

- `e2e/voice-apply-flow.spec.ts`
  - Mock SDK ElevenLabs (existant)
  - Ouvrir page settings → changer voix + vitesse → vérifier toolbar count=2 → Apply → vérifier 1 seul POST `/api/voice/preferences` avec batch payload
  - Démarrer appel mocké → ouvrir VoiceLiveSettings → changer langue → vérifier label "Appliquer & redémarrer" → Apply → vérifier endSession + nouveau startSession appelés sur le SDK mock

## 12. Critères d'acceptation

- [ ] Aucun changement non-live ne déclenche `voiceApi.updatePreferences()` avant click Apply
- [ ] Apply en appel actif déclenche restart automatique en moins de 2s côté UI
- [ ] Volume slider reste réactif en temps réel (pas de stage)
- [ ] Toolbar visible si et seulement si `hasChanges === true`
- [ ] Compteur de la toolbar reflète le nombre exact de clés dans `staged`
- [ ] Le bouton primaire affiche "Appliquer & redémarrer" quand call_active + restart_required
- [ ] Aucun banner `restart_required` legacy reste actif dans `VoiceModal`
- [ ] Tous les tests unitaires existants restent verts
- [ ] Nouveaux tests unitaires + E2E happy path passent

## 13. Plan de migration

1. Créer fichiers NEW sans toucher aux composants existants (provider, toolbar, helpers, bus events)
2. Wrap `App.tsx` avec provider + toolbar (rendu mais inerte tant que personne n'appelle `stage()`)
3. Refactor `VoiceSettings.tsx` pour utiliser `stage()` (le plus gros changement)
4. Refactor `VoiceLiveSettings.tsx` pour utiliser `stage()` sur les champs non-live
5. Câbler `useVoiceChat` (publish + subscribe)
6. Supprimer banner restart_required de `VoiceModal`
7. Tests unitaires + E2E
8. Manual QA sur les 3 surfaces : page standalone, modal, overlay in-call

Chaque étape est shippable indépendamment avec backwards compat (le provider `stage()` peut tomber back sur save direct si pas wrap).

## 14. Risques

| Risque                                                                                 | Mitigation                                                                                                                            |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Restart ElevenLabs perd le contexte agent en cours                                     | Documenté comme limitation acceptée (D2). Tooltip discret sur le bouton "Appliquer & redémarrer" pour informer.                       |
| Backend `updatePreferences` ne supporte pas tous les champs en batch                   | Vérifier `backend/src/voice/preferences.py` — endpoint accepte déjà un `Partial<VoicePreferences>`. À confirmer dans phase 0 du plan. |
| Régression sur tests existants `VoiceLiveSettings.test.tsx` etc.                       | Les modifs sont additives (changement d'appel save → stage). Tests à adapter.                                                         |
| Toolbar masque du contenu en bas de page                                               | `bottom: 24px` au-dessus du Quick Voice Call FAB existant ; adjust si conflit visuel.                                                 |
| Provider mounted globalement = fetch préf au login même si user ne va jamais sur voice | Lazy : ne fetch `applied` que sur premier `stage()` ou première lecture.                                                              |

## 15. Références

- Code existant : `frontend/src/components/voice/{VoiceSettings,VoiceLiveSettings,VoiceOverlay,VoiceModal,useVoiceChat,voicePrefsBus}.tsx`
- Spec parent ElevenLabs ecosystem : `docs/superpowers/specs/2026-04-25-elevenlabs-ecosystem-architecture-design.md`
- Spec Quick Voice Call (UI voisine, ne pas confondre) : `docs/superpowers/specs/2026-04-26-quick-voice-call-design.md`
