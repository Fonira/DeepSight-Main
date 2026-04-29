# Sprint Contexte Agent — Bidir DashboardPage + Mémoire 8k tokens

**Date** : 2026-04-27
**Auteur** : @maximeleparc3 + Claude Opus 4.7
**Statut** : Design validé, prêt pour planification d'implémentation

## Contexte

Les agents voice ElevenLabs reçoivent déjà un contexte vidéo riche et les **10 derniers messages** de chat texte à l'ouverture d'une session (Spec #1 Task 6, déjà en prod). La table `chat_messages` est unifiée depuis la migration `007_unify_chat_voice_messages.py` : voice et chat texte y écrivent tous les deux.

Sur la `ChatPage`, la **sync bidirectionnelle** chat ↔ voice est implémentée (Spec #5) : pendant un appel, l'utilisateur peut taper dans le chat et l'agent vocal le reçoit, et inversement les transcripts vocaux apparaissent dans la timeline du chat.

**Ce sprint comble deux trous identifiés** :

1. La `DashboardPage` n'a pas la sync bidir : le `VoiceModal` plein écran masque le `ChatPanel` et n'a pas de routage des transcripts.
2. La fenêtre de mémoire injectée au system prompt voice est limitée à 10 messages, alors que l'utilisateur veut que l'agent « se souvienne de tout » sur la vidéo en cours.

Hors scope, par décision explicite :

- Extension Chrome bidir (sens chat → voice non câblé)
- Mémoire cross-vidéos (chaque vidéo reste un îlot de contexte)
- Résumé LLM des sessions antérieures
- Suppression définitive de `VoiceModal.tsx` (cleanup ultérieur)
- Bidir pour les debates (`debate_chat_messages` est une table séparée)

## Architecture (vue d'ensemble)

Deux changements indépendants, livrables séparément :

| Couche   | Composant                                                                     | Changement                                                                                  |
| -------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Frontend | `frontend/src/pages/DashboardPage.tsx`                                        | Migration `VoiceModal` → `VoiceOverlay` + handlers de sync bidir + auto-open du `ChatPanel` |
| Backend  | `backend/src/voice/router.py:908-942` (`_build_chat_history_block_for_voice`) | Injection de tout l'historique text+voice jusqu'à 8k tokens                                 |
| Backend  | `backend/src/core/config.py`                                                  | Ajout de `VOICE_HISTORY_MAX_TOKENS: int = 8000`                                             |

Aucune migration DB. Aucun changement d'API publique. Compatible rétro avec `ChatPage`, Mobile et Extension (qui ne sont pas modifiés).

## Frontend — Migration DashboardPage

**Fichier** : `frontend/src/pages/DashboardPage.tsx`

**Imports** :

- Retirer `import { VoiceModal } from "../components/voice/VoiceModal"`
- Ajouter `import { VoiceOverlay, type VoiceOverlayMessage, type VoiceOverlayController } from "../components/voice/VoiceOverlay"`

**State et refs** :

- Renommer `isVoiceModalOpen` → `isVoiceOverlayOpen` (cohérence, optionnel mais recommandé)
- Ajouter `voiceControllerRef = useRef<VoiceOverlayController | null>(null)`

**Handlers** (copie du pattern `ChatPage.tsx:308-369`) :

```typescript
const handleVoiceMessage = useCallback((msg: VoiceOverlayMessage) => {
  setMessages((prev) => [
    ...prev,
    {
      id:
        crypto.randomUUID?.() ??
        `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: msg.source === "user" ? "user" : "assistant",
      content: msg.text,
      source: msg.source === "user" ? "voice_user" : "voice_agent",
      voice_session_id: msg.voiceSessionId,
      time_in_call_secs: msg.timeInCallSecs,
      timestamp: Date.now(),
    },
  ]);
}, []);
```

**Wrapper de l'envoi** : `ChatPanel` reçoit déjà `onSendMessage` en prop depuis `DashboardPage`. C'est cette fonction parente qui est wrappée Route A / Route B :

```typescript
// Dans DashboardPage, fonction passée à ChatPanel via onSendMessage
const handleSendMessage = useCallback(
  async (message: string, options?: { useWebSearch?: boolean }) => {
    const voiceController = voiceControllerRef.current;
    const voiceActive = !!voiceController?.isActive;

    // Append le message user immédiatement dans la timeline
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID?.() ?? `user-${Date.now()}`,
        role: "user",
        content: message,
        source: voiceActive ? "voice_user" : "text",
        voice_session_id: voiceActive
          ? (voiceController?.voiceSessionId ?? null)
          : undefined,
      },
    ]);

    // ROUTE A : voice actif → injection ElevenLabs
    if (voiceActive && voiceController) {
      voiceController.sendUserMessage(message);
      return; // L'agent répond vocalement, captured via handleVoiceMessage
    }

    // ROUTE B : pure text → appel REST chatApi.send (logique existante)
    // ...
  },
  [
    /* deps */
  ],
);
```

**Extension de l'interface `ChatMessage` dans `ChatPanel.tsx`** : aujourd'hui (`ChatPanel.tsx:46-52`) elle ne contient que `id`, `role`, `content`, `sources`, `web_search_used`. Ajouter les champs optionnels :

```typescript
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  web_search_used?: boolean;
  source?: "text" | "voice_user" | "voice_agent";
  voice_session_id?: string | null;
  time_in_call_secs?: number;
}
```

Et adapter le rendu pour afficher un badge distinctif sur les messages `source === "voice_user"` / `voice_agent` (ex: petite icône micro à côté de l'avatar).

**Remplacement du composant** (ligne 1738) :

```jsx
<VoiceOverlay
  isOpen={isVoiceOverlayOpen}
  onClose={() => setIsVoiceOverlayOpen(false)}
  onVoiceMessage={handleVoiceMessage}
  controllerRef={voiceControllerRef}
  summaryId={selectedAnalysis?.id}
  agentType="explorer"
  language={lang}
  title={selectedAnalysis?.title}
/>
```

**Auto-open ChatPanel** : aux deux points de déclenchement du voice (`onOpen` ligne 1388 et le callback ligne 1527), wrapper l'action :

```typescript
const openVoiceWithChat = () => {
  setIsVoiceOverlayOpen(true);
  if (!isChatPanelOpen) setIsChatPanelOpen(true); // No-op si déjà ouvert
};
```

Sans cette ouverture, la sync est invisible et le sprint perd son intérêt UX.

**Cohabitation `VoiceModal`** : le composant reste utilisé par `DebatePage` (et potentiellement d'autres surfaces). Pas de suppression dans cette PR.

## Backend — Mémoire étendue

**Fichier principal** : `backend/src/voice/router.py:908-942`

**Algorithme** :

1. SELECT all `chat_messages` WHERE `summary_id = ?` ORDER BY `created_at DESC` (text + voice mélangés grâce à la table unifiée).
2. Greedy : itérer du plus récent au plus ancien, accumuler dans `selected[]` tant que `total_chars / 4 ≤ TOKEN_BUDGET * 4`.
3. Si le 1er message dépasse déjà `TOKEN_BUDGET` (rare mais possible avec un message géant) → l'inclure quand même, complet.
4. `selected.reverse()` pour rendre l'ordre chronologique avant la concaténation et l'injection.

**Format de ligne** (suffixe `HH:MM` extrait de `created_at`) :

| Type        | Format                                |
| ----------- | ------------------------------------- |
| Text user   | `[Texte utilisateur HH:MM] {content}` |
| Text agent  | `[Texte agent HH:MM] {content}`       |
| Voice user  | `[Voix utilisateur HH:MM] {content}`  |
| Voice agent | `[Voix agent HH:MM] {content}`        |

Ces tags permettent à l'agent ElevenLabs de comprendre quels échanges ont déjà eu lieu en vocal vs en texte, et donc d'éviter de re-déballer du contenu déjà dit oralement.

**Configuration** :

`backend/src/core/config.py` :

```python
VOICE_HISTORY_MAX_TOKENS: int = 8000
```

Approximation tokens : `len(line) // 4`. Suffisant pour bornage, évite la dépendance `tiktoken` et sa latence.

**Effet attendu sur le system prompt** :

- Avant : ~5k tokens (`agent_prompt` ~1-2k + `LANGUAGE` ~200 + `ctx_video` ~3k + `history` 10 msgs ~500)
- Après : ~13k tokens (history monte à 8k)

ElevenLabs accepte largement, mais c'est ~2.6× le coût initial du first reply (négligeable, ~0.01 € par session).

## Data Flow

### Frontend — Pendant un appel sur DashboardPage

```
User clic bouton voice
  → setIsVoiceOverlayOpen(true) + open ChatPanel si fermé
  → VoiceOverlay autoStart
  → POST /api/voice/session (existant)
  → ElevenLabs SDK connecte

[Pendant l'appel]

  Voice → Chat:
    SDK onMessage (user ou agent)
      → handleVoiceMessage(msg)
      → setMessages append (source: voice_user / voice_agent)
      → POST /api/voice/transcripts/append (existant, idempotent)

  Chat → Voice:
    User tape dans ChatPanel handleSend(text)
      → voiceControllerRef.current.sendUserMessage(text)
      → ElevenLabs reçoit, agent répond vocalement
      → SDK onMessage capture la réponse → boucle Voice → Chat ci-dessus

User raccroche
  → onClose → POST /api/voice/session/{id}/end (existant)
```

### Backend — À l'ouverture d'une session

```
POST /api/voice/session
  → build_rich_context(summary)
       → ctx_block (résumé vidéo, ~3k tokens)
  → _build_chat_history_block_for_voice(summary_id)  [NOUVEAU comportement]
       → SELECT all chat_messages WHERE summary_id ORDER BY created_at DESC
       → greedy jusqu'à 8k tokens
       → reverse pour ordre chronologique
       → format avec tags [Texte/Voix utilisateur/agent HH:MM]
  → system_prompt = agent_prompt + LANGUAGE_ENFORCEMENT + ctx_block + history_block
  → client.create_conversation_agent(system_prompt=..., ...)
  → return signed_url + conversation_token
```

## Error Handling

### Frontend

| Erreur                                                    | Comportement                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `sendUserMessage` lève (session inactive)                 | Fallback `chatApi.send` REST. Pattern existant `ChatPage.tsx:362-365`. |
| VoiceOverlay erreur démarrage (quota dépassé, mic refusé) | Message d'erreur dans l'overlay (déjà géré par VoiceOverlay existant). |
| `handleVoiceMessage` lève (rare)                          | Catch + log warning, ne casse pas l'appel.                             |

### Backend

| Erreur                                                | Comportement                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `_build_chat_history_block_for_voice` lève (DB error) | Injecter bloc vide + log warning. **Pas de crash session**.                |
| `VOICE_HISTORY_MAX_TOKENS` invalide (négatif, string) | Fallback à 8000 + log warning au démarrage.                                |
| Aucun message dans l'historique                       | Bloc vide injecté (équivalent au comportement actuel sur une vidéo neuve). |

## Tests

### Backend (pytest)

Étendre les tests existants pour `_build_chat_history_block_for_voice` :

| Cas                                            | Attendu                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| 0 message                                      | Bloc vide                                                         |
| 5 messages text                                | Tous injectés, format `[Texte user/agent HH:MM]`                  |
| 5 messages voice                               | Tous injectés, format `[Voix user/agent HH:MM]`                   |
| Mix 10 text + 10 voice                         | Ordre chronologique respecté, tags distinctifs                    |
| 200 messages courts                            | Tronqué à ~8k tokens, plus récents conservés, ordre chronologique |
| 1 message géant >8k tokens                     | Injecté quand même, complet                                       |
| `VOICE_HISTORY_MAX_TOKENS=4000` (env override) | Tronqué à 4k tokens                                               |

### Frontend (Vitest unit)

Nouveau fichier : `frontend/src/pages/__tests__/DashboardPage.voice.test.tsx`

| Cas                        | Attendu                                                                        |
| -------------------------- | ------------------------------------------------------------------------------ |
| `handleVoiceMessage` user  | Append message avec `source: "voice_user"` et metadata                         |
| `handleVoiceMessage` agent | Append message avec `source: "voice_agent"` et metadata                        |
| `handleSend` voice actif   | Appelle `voiceControllerRef.sendUserMessage(text)`, ne call pas `chatApi.send` |
| `handleSend` voice inactif | Appelle `chatApi.send`, ne touche pas le controller                            |
| Clic bouton voice          | `setIsVoiceOverlayOpen(true)` + `setIsChatPanelOpen(true)`                     |

### Frontend (Playwright E2E)

Nouveau fichier : `frontend/e2e/dashboard-voice-bidir.spec.ts`

| Scénario                             | Attendu                                                         |
| ------------------------------------ | --------------------------------------------------------------- |
| Login → Dashboard → clic voice       | VoiceOverlay visible bottom-right + ChatPanel auto-ouvert       |
| Voice actif + tape texte dans chat   | Texte apparaît immédiatement dans la timeline avec badge "user" |
| Voice actif + agent dit X (mock SDK) | X apparaît dans la timeline avec badge "voice_agent"            |
| Raccrocher                           | VoiceOverlay disparaît, timeline conservée                      |

## Plan de déploiement

1. **PR Backend mémoire étendue** (déployable seul) — extend `_build_chat_history_block_for_voice` + config + tests pytest. Migration ZÉRO. Rollback safe (juste revert le code).
2. **PR Frontend DashboardPage migration** (déployable seul) — refactor DashboardPage + tests Vitest + Playwright. Rollback safe (revert composant).
3. **Vérification post-déploiement** :
   - Backend : ouvrir une session voice depuis ChatPage (qui marche déjà), vérifier dans les logs Hetzner que `system_prompt` injecté est plus long et contient les nouveaux tags.
   - Frontend : ouvrir une session voice depuis Dashboard, vérifier que le ChatPanel s'ouvre, taper du texte, vérifier la sync.

## Métriques de succès

- Backend : taux de sessions voice où l'historique injecté > 10 messages (devrait passer de 0% à >50% dans la première semaine).
- Frontend : sessions voice ouvertes depuis Dashboard avec ChatPanel ouvert pendant l'appel (devrait passer de ~0% à proche de 100%, puisque c'est auto-ouvert).
- Qualitatif : tester soi-même en posant une question voice qui référence un message texte échangé 30 minutes plus tôt.

## Décisions clés et alternatives écartées

| Décision                                | Alternatives écartées                                                                                                                                                       | Raison                                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration `VoiceOverlay` (Approche A)   | B : étendre `VoiceModal` ; C : hybrid `useVoiceChat` direct                                                                                                                 | A réutilise du code battle-tested, supprime de la dette long terme, et l'overlay non-bloquant est intrinsèquement meilleur pour la sync bidir live. |
| Tout l'historique brut jusqu'à N tokens | Résumé LLM ; recherche sémantique RAG                                                                                                                                       | Simple, déterministe, pas de coût LLM additionnel, latence ouverture session inchangée.                                                             |
| 8k tokens budget                        | 4k (trop court pour vidéos discutées longuement) ; 16k (sature le system prompt si vidéo longue) ; configurable par plan (ajoute complexité, à faire plus tard si justifié) | 8k couvre 30-50 échanges, marge confortable, coût négligeable.                                                                                      |
| Approximation tokens `len // 4`         | `tiktoken` exact                                                                                                                                                            | Évite dépendance + latence ; bornage approximatif suffisant.                                                                                        |
| Format `[Voix vs Texte HH:MM]`          | Pas de tag, chronologique brut                                                                                                                                              | Aide l'agent à savoir s'il a déjà parlé d'un sujet à l'oral et à éviter le re-déballer.                                                             |

## Annexe — Fichiers touchés (récap)

| Fichier                                                     | Type de changement                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| `backend/src/voice/router.py` (lignes 908-942)              | Modification fonction `_build_chat_history_block_for_voice` |
| `backend/src/core/config.py`                                | Ajout `VOICE_HISTORY_MAX_TOKENS: int = 8000`                |
| `backend/tests/voice/test_router.py` (ou équivalent)        | Nouveaux tests pytest                                       |
| `frontend/src/pages/DashboardPage.tsx`                      | Refactor imports, state, handlers, JSX                      |
| `frontend/src/pages/__tests__/DashboardPage.voice.test.tsx` | Nouveau fichier Vitest                                      |
| `frontend/e2e/dashboard-voice-bidir.spec.ts`                | Nouveau fichier Playwright                                  |
