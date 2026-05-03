---
date: 2026-05-03
type: spec-design
scope: DeepSight Web — refonte navigation et affichage du Hub (/hub)
status: draft (en attente de review user)
branch: fix/hub-nav-redesign
related:
  - docs/audit/2026-05-03-deepsight-web-audit.md (audit complet web)
  - PR #276 (refonte SummaryCollapsible + InputBar opaque + logo cliquable)
  - PR #277 (mobile EmptyConversationSuggestions)
auteur: Claude Opus 4.7
---

# Spec — Hub Navigation Redesign (Axe B : Tabs sticky global)

## 1. Contexte

Le Hub (`/hub`) fusionne ChatPage et VoiceCallPage depuis PR #214. L'architecture
actuelle est **single column scroll vertical** : `HubHeader` → `HubAnalysisPanel`
(5 onglets internes Synthèse/Quiz/Flashcards/Fiabilité/GEO) → `Timeline` → `InputBar`
sticky bottom → `SourcesShelf` orphelin.

L'audit complet du 2026-05-03 (`docs/audit/2026-05-03-deepsight-web-audit.md`) a
identifié 5 findings ciblés `/hub` (F2/F5/F6/F7 + P2 wording). Une session live
complémentaire sur prod via Claude in Chrome a confirmé les 7 frictions identifiées
en analyse statique + révélé 8 frictions additionnelles. Score subjectif global :
4,7/10.

La racine cognitive : **un seul conteneur scrollable** mélange deux modes mentaux
(lecture analytique de la synthèse vs conversation chat), et la tab bar interne du
panel d'analyse n'est sticky que dans le panel — donc disparaît dès que l'utilisateur
scrolle vers le chat. Switcher Synthèse↔Fiabilité après avoir chatté oblige à
remonter ~6800 px.

## 2. Audit — frictions à résoudre

### 2.1 Confirmées P0/P1 (audit live + statique)

| ID  | Friction                                                                                                              | Source                                                         | Sévérité              |
| --- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------- |
| F1  | Tab bar (5 onglets) disparaît au scroll — sticky absent au niveau global                                              | Live + code (HubPage.tsx ligne 432, AnalysisHub.tsx ligne 215) | **P0**                |
| F2  | Trois entrées "home" redondantes : pill `Accueil` + burger ☰ + logo cliquable                                        | HubHeader.tsx 39-77                                            | P1                    |
| F3  | Empty state "Posez votre première question" rendu sous un panel rempli — hiérarchie cassée quand conv déjà chargée    | Timeline.tsx 31-46                                             | P1                    |
| F4  | Bandeau "Plateformes supportées" orphelin sous l'InputBar, séparé par hairline 1px illisible                          | HubPage.tsx 449-453                                            | P1                    |
| F5  | Markdown brut dans messages chat (`**`, `###`, `[text](url)` non parsés) — deux pipelines de rendu cohabitent         | Live, MessageBubble.tsx                                        | **P0**                |
| F6  | Conversations dupliquées 4× (`Éric Sadin`), 2× (`TikTok Video`), titres polluttés `(3) ...`                           | Live + code                                                    | (backend, hors scope) |
| F7  | Durée nulle propagée 3 endroits : subtitle header, badge thumbnail `00:00`, widget "Valeur de cette analyse" `~0 sec` | Live                                                           | P1                    |

### 2.2 Nouvelles (audit live)

| ID  | Friction                                                                                     | Sévérité           |
| --- | -------------------------------------------------------------------------------------------- | ------------------ |
| F8  | Toolbar actions tronqué à ≥lg (boutons "Citer", "Écouter" coupés sans overflow scroll)       | P1                 |
| F9  | Titre conv déborde dans header sans `line-clamp-1` (tronquage brutal)                        | P1                 |
| F10 | Accents manquants tab GEO (`Citabilite`, `Autorite`, `Fraicheur`)                            | (i18n, hors scope) |
| F11 | Singulier/pluriel non géré ("1 affirmations analysées")                                      | (i18n, hors scope) |
| F12 | Score GEO incohérent (57/100 mais 0 claims solides sur 0)                                    | (data, hors scope) |
| F13 | Drawer pas d'active state lisible quand 4 doublons identiques                                | P1                 |
| F14 | Scroll après envoi message saute au milieu de la synthèse, pas au user-bubble                | P1                 |
| F15 | Mono-scroll = changer de tab garde la position scroll, peut envoyer user au milieu d'un quiz | P1                 |

### 2.3 Mobile (393px iPhone 14 Pro)

- Header explose : titre tronqué `T...`, miniature avec play+badge `00:00` rejetée loin à droite.
- Toolbar actions déborde à droite.
- Tab `Flashca…` tronquée dans la tab bar horizontale.

## 3. Décisions UX validées

| Question                     | Décision                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| F2 — quel "home" garder ?    | **Logo cliquable seul.** Pill "Accueil" supprimé. Pattern attendu (ChatGPT, Linear).         |
| F5 — markdown chat scope ?   | **In scope.** `react-markdown` + `remark-gfm` dans `MessageBubble`. P0 critique.             |
| F4 — bandeau "Plateformes" ? | **Chip repliable dans InputBar** (`▾ Plateformes : YT · TikTok`). Bandeau orphelin supprimé. |
| Préserver scroll par tab ?   | **Oui, mémoriser** (`useRef<Map<TabId, number>>`). Restitue position au retour sur un tab.   |

## 4. Scope

### 4.1 Inclus

- F1 : layout 2-band sticky (HubHeader + HubTabBar sticky global)
- F2 : home unique (logo cliquable, pill supprimé)
- F3 : empty state contextuel (apparaît uniquement sur l'onglet Chat vide)
- F4 : chip Plateformes intégré InputBar, suppression `SourcesShelf`
- F5 : `react-markdown` + `remark-gfm` dans `MessageBubble`
- F7 : guard `duration > 0` (subtitle, badge, widget value)
- F8 : overflow horizontal scroll + menu `⋯` pour toolbar actions
- F9 : `line-clamp-1` sur titre header
- F13 : active state explicite drawer (ring indigo + créa courte)
- F14 : `scrollIntoView` sur user-bubble après envoi
- F15 : mémoire scroll par tab (`Map<TabId, number>`)

### 4.2 Hors scope (PRs séparés)

- **F6 — Dedup backend** : ajouter unique constraint `(user_id, source_url)` ou
  job de dedup post-extraction. Trop transverse pour ce PR. → spec/issue dédié.
- **F10/F11 — i18n cleanup** : passe transverse sur `frontend/src/i18n/{fr,en}.json`
  pour fixer accents et pluriels. → autre PR (XS effort, mais hors scope navigation).
- **F12 — Score GEO incohérent** : data layer / backend GEO scoring. → hors UI.

## 5. Architecture cible

### 5.1 Layout

```
┌─ HubHeader (sticky top, 56px desktop / 48px mobile) ──────────┐
│ ☰  [Logo→/]  Titre conv (line-clamp-1)              [PiP]    │
│              Sous-titre : YT · 18:32 · il y a 12 min          │
├───────────────────────────────────────────────────────────────┤
│ HubTabBar (sticky top-[56px], second band toujours visible)   │
│  [Synthèse · Quiz · Flashcards · Fiabilité · GEO · Chat (n)] │
├───────────────────────────────────────────────────────────────┤
│ TabPanel (flex-1, scroll INTERNE propre, key={activeTab})     │
│                                                               │
│  Synthèse / Quiz / Flashcards / Fiabilité / GEO :            │
│    contenu de l'onglet (toolbar actions au top, overflow      │
│    horizontal scroll + menu "⋯" si > 4 boutons)               │
│                                                               │
│  Chat :                                                       │
│    Timeline messages (markdown rendu via react-markdown)      │
│    Si vide → empty state contextuel cohérent                 │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│ InputBar unifiée (sticky bottom, flex-shrink-0)               │
│  [+] [Posez votre question…]   [📞] [🎤/Send]                 │
│  [▾ Plateformes : YT · TikTok]  ← chip repliable              │
└───────────────────────────────────────────────────────────────┘
```

### 5.2 Comportements

#### Tab bar sticky global

- Conteneur racine : `<div className="relative h-screen flex flex-col overflow-hidden">`
- HubHeader : `sticky top-0 z-20`
- HubTabBar : `sticky top-[56px] z-10`. Sur mobile (`<sm`), top devient `top-[48px]`.
- TabPanel : `flex-1 overflow-y-auto min-h-0 relative`. Le scroll est INTERNE au panel, donc HubHeader + HubTabBar restent toujours visibles. F1 résolue.

#### Onglet par défaut au mount

- Si `?tab=<id>` dans l'URL → cet onglet.
- Sinon, conversation chargée avec messages → `chat`.
- Sinon → `synthesis`.
- Switch d'onglet pousse `setSearchParams({ tab, conv })` (URL deep-link).

#### Onglet Chat — empty state contextuel

- Si `messages.length === 0` ET on est sur l'onglet Chat → empty state actuel (`Sparkles + "Posez votre première question"`) — désormais cohérent : on est dans le tab vide.
- Sinon, Timeline normale.
- Si conv non chargée (`activeConvId === null`) → empty state global différent : "Choisissez une conversation ou collez une URL".

#### Scroll preservation

- `useRef<Map<TabId, number>>` dans HubPage.
- Au switch de tab : sauvegarder `scrollTop` du panel courant, restaurer celui du nouveau (ou 0 si jamais visité).
- Implémentation : ne pas utiliser `key={activeTab}` (provoque remount complet — perte du state des sous-composants comme quiz). Préférer un wrapper qui restore via `useLayoutEffect`.

#### Scroll-to-bubble après envoi

- Ref sur le user-bubble fraîchement créé (`messageRef.current[newId]`).
- Après `appendMessage`, `scrollIntoView({ behavior: "smooth", block: "end" })` — scroll juste assez pour montrer le user-bubble + début de la réponse en cours. F14 résolue.

#### InputBar context-aware

- Visible sur tous les onglets.
- Sur l'onglet Chat → comportement actuel (envoi message).
- Sur autre onglet → l'envoi pré-remplit le message ET switche sur l'onglet Chat. Comportement attendu : "où que je sois dans le Hub, taper une question m'amène au chat".
- Chip `▾ Plateformes` collapse : ouvert par défaut, repliable. State persistant via `localStorage` (`hub-platforms-chip-collapsed`).

#### Header polish

- `line-clamp-1` sur `<p>{title}</p>` (F9).
- Badge `00:00` masqué dans VideoPiPPlayer si `durationSecs <= 0` (F7).
- Subtitle omet la durée si `durationSecs === 0` ou `null` (F7) :
  - `parts.push(duration)` → `if (duration && duration !== "0:00") parts.push(duration)`.
- Widget "Valeur de cette analyse" guard `duration > 60` (sinon ne pas afficher gain de temps absurde) (F7).
- Suppression du bouton pill `Accueil` (F2). Logo reste cliquable et focus-visible.

#### Toolbar actions overflow

- Container : `<div className="flex gap-2 overflow-x-auto scrollbar-hide" role="toolbar">`.
- Si nombre boutons > 4 et viewport < lg → bascule en menu `⋯` (DropdownMenu shadcn-like).
- Sinon scroll horizontal naturel.
- F8 résolue à toutes les viewports.

#### Drawer active state

- Item correspondant à `activeConvId` :
  - `ring-2 ring-indigo-500/40` au lieu de juste `bg-indigo-500/10`.
  - Petit badge "actuelle" texte ou ●.
- Doublons (même titre) : ajouter `created_at` formaté court (`12 mars`) en suffixe pour différencier (F13).

#### Markdown chat

- Remplacer rendu actuel `<p>` dans MessageBubble par `<ReactMarkdown remarkPlugins={[remarkGfm]}>` avec components custom :
  - `a` → ouvre `target="_blank" rel="noopener noreferrer"`, style indigo souligné
  - `code` (inline) → `<code className="px-1 py-0.5 bg-white/10 rounded text-xs">`
  - `pre` → bloc code avec copy button
  - `ul`, `ol`, `li` → list-disc/list-decimal pl-5
  - `h1-h6` → typo Inter (h2 = `text-base font-semibold`, h3 = `text-sm font-semibold`)
  - `table` → wrapper scroll-x
- F5 résolue.

## 6. Composants impactés

| Fichier                                               | Action                                                                | Complexité |
| ----------------------------------------------------- | --------------------------------------------------------------------- | ---------- |
| `frontend/src/pages/HubPage.tsx`                      | **Refacto majeur**                                                    | M          |
| `frontend/src/components/hub/HubHeader.tsx`           | Edit (retirer pill, line-clamp, guard subtitle)                       | S          |
| `frontend/src/components/hub/HubAnalysisPanel.tsx`    | Refacto (n'expose plus tab bar)                                       | M          |
| `frontend/src/components/hub/HubTabBar.tsx`           | **Nouveau** (extrait + ajout onglet Chat)                             | M          |
| `frontend/src/components/AnalysisHub/index.tsx`       | Refacto (retire tab bar interne, expose onglets en mode "controlled") | S          |
| `frontend/src/components/hub/Timeline.tsx`            | Edit (empty state contextuel, scroll-to-bubble)                       | S          |
| `frontend/src/components/hub/MessageBubble.tsx`       | Edit (`react-markdown` + `remark-gfm`)                                | M          |
| `frontend/src/components/hub/InputBar.tsx`            | Edit (chip Plateformes + comportement context-aware)                  | S          |
| `frontend/src/components/hub/SourcesShelf.tsx`        | **Supprimer**                                                         | XS         |
| `frontend/src/components/hub/VideoPiPPlayer.tsx`      | Edit (guard badge `00:00`)                                            | XS         |
| `frontend/src/components/hub/ConversationsDrawer.tsx` | Edit (active state + créa date)                                       | S          |
| `frontend/src/store/hubStore.ts`                      | Edit (`activeTab: TabId`, `tabScrollPositions: Map<TabId, number>`)   | S          |
| `frontend/src/components/hub/types.ts`                | Edit (ajouter `TabId` type)                                           | XS         |
| Tests `__tests__/*.test.tsx`                          | Maj + nouveaux tests                                                  | M          |
| `frontend/src/pages/HubPage.tsx` (toolbox actions)    | Edit toolbar actions overflow + menu                                  | S          |

Total estimation : ~14 fichiers touchés, ~600-900 lignes diff.

## 7. États & flows clés

### 7.1 États du Hub

| État global                         | Tab par défaut                                          | Empty state visible ?       | Notes                                              |
| ----------------------------------- | ------------------------------------------------------- | --------------------------- | -------------------------------------------------- |
| Aucune conv (`activeConvId = null`) | Pas de tabs (placeholder "Choisissez une conversation") | Empty global                | Tab bar masquée tant qu'aucune conv                |
| Conv chargée, 0 messages            | `synthesis`                                             | Sur tab Chat seulement      | Synthèse en avant-plan, chat dispo via clic onglet |
| Conv chargée, ≥1 messages           | `chat` (déduit de l'historique)                         | Non                         | User reprend là où il s'est arrêté                 |
| Analyzing en cours (`?analyzing=`)  | Pas de tabs                                             | Loader plein-écran existant | Comportement actuel préservé                       |
| Voice call ouvert                   | Pas de tabs (overlay fullscreen)                        | Non                         | `<CallModeFullBleed>` overlay actuel               |

### 7.2 Flow envoi message depuis tab non-Chat

1. User est sur `synthesis`. Tape "Quels sont les biais ?" dans InputBar et appuie Send.
2. `handleSend` détecte `activeTab !== "chat"` → `setActiveTab("chat")` + `setSearchParams({ tab: "chat", conv })`.
3. `appendMessage` user, puis fetch IA, etc. (logique actuelle).
4. Le scroll du panel Chat est en bas (premier message de la conv) — `scrollIntoView` sur le user-bubble.

## 8. Risques & migration

### 8.1 Risques

- **Tests Playwright `e2e/hub.spec.ts`** doivent être adaptés (sélecteurs onglet, sticky tabbar). Effort : S.
- **`react-markdown`** : vérifier qu'il est déjà dans le projet (probablement via SynthesisTab). Sinon ajout ~12 kB gz acceptable.
- **State preservation pour Quiz/Flashcards en cours** : si l'utilisateur génère un quiz puis switche sur Chat puis revient, le quiz state actuel (questions, réponses sélectionnées) doit être préservé. Vérifier que `AnalysisHub` ne reset pas son state à chaque "rerender". Stratégie : éviter `key={activeTab}` (qui force remount) et préférer un wrapper qui pilote `display: none/block` ou un `useState` lift-up.
- **Mobile double-band header** (96px total) : à monitorer sur ≤375px viewport.
- **Vault MCP / spec sync** : ce spec sera aussi noté dans `01-Projects/DeepSight/Specs/` du vault Obsidian (fait après commit).

### 8.2 Migration

- Pas de migration backend.
- Pas de migration data.
- Suppression de `SourcesShelf` : aucun import externe au Hub (vérifié via grep `SourcesShelf` → uniquement dans `HubPage.tsx`).
- URL `?conv=` reste compatible. Ajout `?tab=` optionnel.

### 8.3 Rollback

- Si problème en prod, revert PR sur `main` → recréation immédiate de l'archi actuelle.
- Aucun changement irréversible (DB, env, config).

## 9. Tests

### 9.1 Vitest unit

- `HubTabBar.test.tsx` (nouveau) : rendu 6 onglets, badge count, click switch.
- `MessageBubble.test.tsx` : rendu markdown (gras, lien, list, code) — vérifier que `**` ne s'affiche plus brut.
- `Timeline.test.tsx` : empty state visible UNIQUEMENT si `activeTab="chat"` ET messages vides ; scroll-to-bubble après nouveau message.
- `InputBar.test.tsx` : envoi sur tab non-chat → switch + setSearchParams.
- `ConversationsDrawer.test.tsx` : active state ring + créa date.
- `HubHeader.test.tsx` : pas de pill Accueil ; line-clamp-1 sur titre ; pas de badge `00:00` si duration=0.

### 9.2 Playwright E2E

- `e2e/hub.spec.ts` : naviguer `/hub`, ouvrir une conv via drawer, vérifier tabbar visible après scroll, switcher tab, envoyer message, vérifier markdown rendu.

### 9.3 Manuel (post-PR)

- Desktop 1280/1440/1920 — pas de troncature toolbar.
- Mobile 375/393 — header compact, tabbar scrollable horizontal sans clip.
- Conv avec markdown riche (titre `### 🛒 Sources` + liens `[text](url)`) → tout rendu.
- Conv avec `duration=0` → pas de "0 sec" affiché nulle part.

## 10. Critères d'acceptation

- [ ] Tab bar Synthèse/Quiz/Flashcards/Fiabilité/GEO/Chat reste visible TOUS les scrolls.
- [ ] Un seul "home" cliquable dans le header (le logo).
- [ ] Empty state "Posez votre première question" apparaît UNIQUEMENT sur tab Chat vide.
- [ ] Bandeau "Plateformes supportées" remplacé par chip dans InputBar.
- [ ] Markdown rendu dans messages chat (gras, liens cliquables, listes, code).
- [ ] Pas d'affichage "0 sec / 00:00" quand duration absente.
- [ ] Toolbar actions accessible à toutes les viewports (overflow scroll ou menu `⋯`).
- [ ] Titre header tronqué proprement avec `line-clamp-1`.
- [ ] Drawer active state visible même avec doublons.
- [ ] Scroll auto sur user-bubble après envoi (pas au milieu de la synthèse).
- [ ] Position scroll mémorisée par tab pendant la session.
- [ ] Tous les tests unit + E2E green.

## 11. Hors scope explicite (à traiter après merge)

- F6 — Dedup conversations backend `(user_id, source_url)` → spec backend dédié.
- F10/F11 — Cleanup i18n GEO/Fiabilité (accents, pluriels) → PR XS séparé.
- F12 — Score GEO incohérent (logique calcul backend) → investigation séparée.
- Refonte mobile-first complète du Hub (breakpoints fins, gestures swipe entre tabs) → V2 si feedback user demande.
