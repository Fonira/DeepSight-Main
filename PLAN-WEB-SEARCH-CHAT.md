# Plan : Web Search Enrichment & Chat IA unifié — DeepSight

## Résumé de la vision

L'objectif est de faire de DeepSight **la source d'analyse vidéo la plus fiable du marché** en intégrant systématiquement des informations web récentes, sourcées et vérifiées dans toutes les interactions IA (résumés, chat, suggestions).

**Principe clé** : Les utilisateurs gratuits voient la valeur (aperçu), les payants en profitent pleinement, graduellement selon leur plan.

---

## État actuel du codebase (ce qui existe déjà)

### Backend ✅ Quasi-complet

- `POST /api/chat/ask` accepte `use_web_search: bool`
- Perplexity intégré via `enrich_chat_response()` (sonar / sonar-pro)
- Auto fact-check sur questions critiques (`_needs_critical_fact_check()`)
- Quotas par plan : Free=0, Starter=20/mois, Pro=100/mois, Expert=500/mois
- Format `[ask:Question]` généré dans les prompts Mistral
- Disclaimer automatique sur réponses non vérifiées

### Frontend Web ⚠️ Partiel

- FloatingChatWindow a le toggle Globe (web search)
- `parseAskQuestions()` parse le format `[ask:...]` correctement
- **MAIS** : suggestions empty state remplissent l'input au lieu d'envoyer directement
- **MAIS** : pas de bouton "Approfondir" après les réponses assistant
- **MAIS** : pas d'affichage du quota restant

### Mobile ❌ Non implémenté

- ChatInput a les props `showWebSearch` / `canUseWebSearch` mais NON câblées
- Pas de parsing `[ask:...]` dans les réponses
- Pas de toggle web search fonctionnel

### Extension ❌ Non implémenté

- Pas de toggle web search
- Pas de suggestions cliquables

---

## Architecture cible

```
┌─────────────────────────────────────────────────────────┐
│                    BACKEND (déjà fait)                    │
│                                                          │
│  POST /api/chat/ask                                      │
│  ├─ use_web_search: bool (toggle utilisateur)            │
│  ├─ auto fact-check (questions critiques)                │
│  └─ Réponse enrichie Perplexity + sources                │
│                                                          │
│  Réponse JSON :                                          │
│  { response, web_search_used, sources[],                 │
│    enrichment_level, quota_info: {used, limit, remaining}│
│    suggested_questions: [ask:...] dans le contenu }      │
└──────────────┬────────────────┬────────────────┬─────────┘
               │                │                │
     ┌─────────▼──┐    ┌───────▼─────┐   ┌──────▼──────┐
     │  WEB APP   │    │   MOBILE    │   │  EXTENSION  │
     │            │    │             │   │             │
     │ ✅ Toggle  │    │ ❌ Toggle   │   │ ❌ Toggle   │
     │ ⚠️ [ask:]  │    │ ❌ [ask:]   │   │ ❌ [ask:]   │
     │ ❌ Appro.  │    │ ❌ Appro.   │   │ ❌ Appro.   │
     │ ❌ Quota   │    │ ❌ Quota    │   │ ❌ Quota    │
     └────────────┘    └─────────────┘   └─────────────┘
```

---

## Plan d'exécution (7 tâches séquentielles)

### TÂCHE 1 — Backend : Ajouter quota_info dans la réponse chat

**Fichier** : `backend/src/chat/router.py`
**Changements** :

- Inclure `quota_info: { used, limit, remaining }` dans `ChatResponseV4`
- Après chaque appel web search, retourner le quota restant
- Ajouter un endpoint `GET /api/chat/web-search-quota` pour que les clients puissent fetch le quota à l'ouverture du chat

**Impact** : Tous les clients (web, mobile, extension) pourront afficher le compteur de quota.

---

### TÂCHE 2 — Frontend Web : Suggestions cliquables → envoi direct

**Fichier** : `frontend/src/components/FloatingChatWindow.tsx`
**Changements** :

- Empty state : les suggestions appellent `onSendMessage(q)` au lieu de `setInput(q)`
- Les `[ask:...]` dans les réponses appellent déjà `onSendMessage()` ✅ (déjà fonctionnel)

**Fichier** : `frontend/src/pages/PlaylistDetailPage.tsx` (CorpusChat)
**Changements** :

- Intégrer `parseAskQuestions()` dans le rendu des messages assistant
- Rendre les suggestions cliquables avec envoi direct (`handleSend` après `setInput`)

---

### TÂCHE 3 — Frontend Web : Bouton "Approfondir" + Affichage quota

**Fichier** : `frontend/src/components/FloatingChatWindow.tsx`
**Changements** :

- Après chaque message assistant : bouton `🔍 Approfondir avec recherche web`
  - Clic → renvoie la dernière question utilisateur avec `use_web_search: true`
  - Grisé + 🔒 pour Free users → tooltip "Disponible dès le plan Starter"
  - Affiche quota restant au hover : "18/20 recherches ce mois"
- Toggle Globe amélioré :
  - Free : icône 🔒 + "Plan Starter requis" au hover
  - Starter/Pro/Expert : fonctionnel + compteur `X/Y restantes`
- Badge visuel "Enrichi par recherche web 🌐" sur les messages qui utilisent web search

**Fichier** : `frontend/src/services/api.ts`

- Typer `quota_info` dans la réponse `ChatResponseV4`
- Ajouter `chatApi.getWebSearchQuota()`

---

### TÂCHE 4 — Frontend Web : Gating par plan (aperçu pour Free)

**Fichier** : `frontend/src/components/FloatingChatWindow.tsx`
**Logique** :

- **Free** : Toggle visible mais verrouillé 🔒, bouton "Approfondir" visible mais verrouillé, après 1ère question → banner discret "Obtenez des réponses enrichies par le web avec le plan Starter"
- **Starter** : Toggle fonctionnel, 20 recherches/mois, compteur affiché, bouton Approfondir fonctionnel
- **Pro** : 100 recherches/mois, enrichissement automatique sur questions critiques
- **Expert** : 500 recherches/mois, mode sonar-pro (réponses plus complètes)

**Props à ajouter** à FloatingChatWindow :

```typescript
userPlan?: 'free' | 'starter' | 'pro' | 'expert';
webSearchQuota?: { used: number; limit: number; remaining: number };
```

---

### TÂCHE 5 — Mobile : Toggle web search + Suggestions cliquables

**Fichier** : `mobile/src/screens/AnalysisScreen.tsx`
**Changements** :

- Ajouter state `isWebSearchEnabled` + `webSearchQuota`
- Câbler `showWebSearch` et `onToggleWebSearch` sur ChatInput (les props existent déjà)
- Passer `use_web_search` dans l'appel API chat

**Fichier** : `mobile/src/components/chat/ChatBubble.tsx`

- Parser `[ask:...]` dans le contenu des messages assistant
- Afficher les questions comme boutons Touchable scrollables horizontaux
- Clic → envoie directement le message

**Fichier** : `mobile/src/services/api.ts`

- Ajouter paramètre `useWebSearch?: boolean` à `sendMessage()`

**Fichier** : `mobile/src/components/chat/ChatInput.tsx`

- Ajouter gating par plan (🔒 si free, compteur si payant)

---

### TÂCHE 6 — Extension : Toggle web search + Suggestions cliquables

**Fichier** : `extension/src/popup/components/ChatDrawer.tsx`
**Changements** :

- Ajouter toggle Globe dans la barre d'input
- State `useWebSearch` + `canUseWebSearch` (basé sur le plan user)
- Passer `use_web_search` dans la requête API
- Parser `[ask:...]` et afficher comme boutons pills sous les messages
- Gating : 🔒 pour free, fonctionnel pour payants

**Fichier** : `extension/src/background.ts`

- Passer `use_web_search` dans l'action `ASK_QUESTION`

---

### TÂCHE 7 — Vérification cross-platform

- [ ] Free user : voit toggle 🔒, voit bouton Approfondir 🔒, voit disclaimer sur réponses non vérifiées
- [ ] Starter : peut toggle web search, quota 20/mois s'affiche et se décrémente
- [ ] Pro : quota 100/mois, mode enrichi automatique sur questions critiques
- [ ] `[ask:Question]` s'affiche et est cliquable (envoi direct) sur Web, Mobile, Extension
- [ ] Bouton "Approfondir" renvoie la question avec web search sur Web
- [ ] Sources affichées avec liens cliquables sur toutes les plateformes
- [ ] Badge "Enrichi par le web 🌐" visible sur messages enrichis
- [ ] Quota se synchronise entre les 3 plateformes (même API backend)

---

## Stratégie de monétisation progressive

| Fonctionnalité        | Free             | Starter       | Pro         | Expert      |
| --------------------- | ---------------- | ------------- | ----------- | ----------- |
| Chat IA               | 5/vidéo          | 20/vidéo      | Illimité    | Illimité    |
| Auto fact-check       | ✅ (disclaimer)  | ✅            | ✅          | ✅          |
| Toggle web search     | 🔒 Verrouillé    | ✅ 20/mois    | ✅ 100/mois | ✅ 500/mois |
| Bouton Approfondir    | 🔒 Verrouillé    | ✅            | ✅          | ✅          |
| Modèle Perplexity     | —                | sonar         | sonar       | sonar-pro   |
| Sources dans réponses | Preview 1 source | 5 sources max | 5 sources   | 8 sources   |
| Suggestions [ask:]    | ✅ Cliquables    | ✅            | ✅          | ✅          |
| Badge "Web enriched"  | Visible (teaser) | ✅            | ✅          | ✅          |

---

## Fichiers impactés (récapitulatif)

| #   | Fichier                                          | Action                                                        |
| --- | ------------------------------------------------ | ------------------------------------------------------------- |
| 1   | `backend/src/chat/router.py`                     | Ajouter quota_info dans réponse                               |
| 2   | `frontend/src/components/FloatingChatWindow.tsx` | Suggestions auto-send, bouton Approfondir, gating plan, quota |
| 3   | `frontend/src/pages/PlaylistDetailPage.tsx`      | Intégrer [ask:] cliquables dans CorpusChat                    |
| 4   | `frontend/src/services/api.ts`                   | Typer quota_info, ajouter getWebSearchQuota()                 |
| 5   | `mobile/src/screens/AnalysisScreen.tsx`          | Câbler toggle web search, passer à API                        |
| 6   | `mobile/src/components/chat/ChatBubble.tsx`      | Parser et afficher [ask:] cliquables                          |
| 7   | `mobile/src/services/api.ts`                     | Ajouter useWebSearch param                                    |
| 8   | `mobile/src/components/chat/ChatInput.tsx`       | Gating plan sur toggle                                        |
| 9   | `extension/src/popup/components/ChatDrawer.tsx`  | Toggle + suggestions + gating                                 |
| 10  | `extension/src/background.ts`                    | Passer use_web_search                                         |

---

## Estimation

| Phase                                | Durée    |
| ------------------------------------ | -------- |
| Tâche 1 (Backend quota)              | ~1h      |
| Tâche 2 (Web suggestions)            | ~1h      |
| Tâche 3 (Web Approfondir + quota UI) | ~2h      |
| Tâche 4 (Web gating plan)            | ~1h      |
| Tâche 5 (Mobile)                     | ~3h      |
| Tâche 6 (Extension)                  | ~2h      |
| Tâche 7 (Vérification)               | ~1h      |
| **Total**                            | **~11h** |

---

## Mon avis sur ta vision

Ta vision est **excellente et cohérente**. Voici ce que je valide :

1. **"Tout sourcé, récent, vérifié"** → Le backend fait déjà du fact-check auto via Perplexity. On renforce l'UX avec des badges visuels et disclaimers.

2. **"Aperçu gratuit → upgrade graduel"** → La meilleure stratégie de conversion. Le Free user voit les boutons 🔒 et les badges "Enrichi par le web", il comprend la valeur sans pouvoir l'utiliser pleinement.

3. **"Bouton recherche étendue"** → Le bouton "Approfondir" est le meilleur UX pour ça. Il re-envoie la question avec Perplexity activé, sans friction.

4. **Suggestions cliquables envoi direct** → Réduit le friction à zéro. L'utilisateur reste dans le flow conversationnel.

**Ce que j'ajouterais** : Un petit indicateur de fiabilité (badge vert/orange/rouge) sur chaque réponse :

- 🟢 "Vérifié par recherche web" (avec sources)
- 🟠 "Non vérifié — basé sur la vidéo uniquement"
- 🔴 "Information potentiellement obsolète"

Ceci renforce la confiance et pousse à upgrader pour avoir le vert.
