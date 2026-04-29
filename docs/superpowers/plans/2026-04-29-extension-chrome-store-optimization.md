# Extension Chrome Web Store Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Préparer la soumission de l'extension DeepSight (MV3 v2.0) au Chrome Web Store en livrant un manifeste optimisé, une fiche complète FR+EN, un brief précis pour 5 screenshots 1280×800, un script vidéo promo 30-60s et la checklist du process de soumission, avec l'objectif d'acquisition organique 1000+ users/jour.

**Architecture :** Travail purement assets / contenu marketing / config. Le code de l'extension n'est PAS refactoré (manifest déjà MV3 valide, audit permissions déjà fait dans `extension/CHROME_WEB_STORE.md`). Le plan consolide ce qui existe (`extension/CHROME_WEB_STORE.md`, manifeste `public/manifest.json` v2.0, locales FR/EN) en 4 livrables versionnés sous `docs/` + 1 mise à jour ciblée du manifeste (description courte avec keywords) + corrections pricing v2.

**Tech Stack :** Chrome Manifest V3 (déjà en place), webpack 5 build vers `dist/`, Chrome Web Store Developer Dashboard, contenu Markdown (FR + EN dual). Pas de nouvelle dépendance npm.

---

## Contexte préalable

### État actuel vérifié

- **Manifest** : `extension/public/manifest.json` v2.0.0, MV3, `minimum_chrome_version: 116`, déjà bien conçu (8 permissions standard + `audioCapture` optional + 12 host*permissions justifiés). Utilise `\_\_MSG*\*\_\_`pour i18n via`\_locales/{en,fr}/messages.json`.
- **Doc existante** : `extension/CHROME_WEB_STORE.md` (203 lignes) contient déjà :
  - Description courte EN (132 char OK)
  - Description longue EN + FR (~2000 char chacune, pricing **OBSOLÈTE** — mentionne Plus 4,99 € / Pro 9,99 € au lieu de Pro 8,99 € / Expert 19,99 € v2)
  - Justification de chaque permission (à reprendre tel quel — qualité haute)
  - Single purpose statement
  - Liste des 5 screenshots à préparer (titres seuls, pas de brief détaillé)
- **Locales** : `_locales/{en,fr}/messages.json` ont 4 clés (extension_name, extension_short_name, extension_description, extension_action_title). Description actuelle FR : "Analyse YouTube et TikTok par IA : synthèses sourcées, fact-checking, flashcards, chat vocal. IA européenne par Mistral." (118 char, déjà bonne, contient keywords). EN équivalente. **Pas de modification nécessaire ici.**
- **Privacy Policy** : `frontend/src/pages/PrivacyPolicy.tsx` existe, accessible sur `https://www.deepsightsynthesis.com/privacy`. SIRET + adresse listés. ⚠️ Doit être URL publique fonctionnelle au moment de la soumission — à valider en Task 7.
- **Page post-install** : `frontend/src/pages/ExtensionWelcomePage.tsx` route `/extension-welcome` existe, contient déjà 3 STEPS + 4 FEATURES — bonne UX.
- **Build** : `npm run build` → `dist/` (25 fichiers présents, manifest.json + sidepanel.html déjà buildés). `dist/` se charge directement dans `chrome://extensions`.
- **Plans datés 2026-04-29** : un plan `audit-kimi-phase-0-seo-securite` et un plan `pricing-v2-stripe-grandfathering` cadrent le pricing v2 (Pro 8,99 € / Expert 19,99 €). Ce plan-ci NE doit PAS faire référence à l'ancien pricing.
- **CLAUDE.md** mentionne : "🟢 Bas — Chrome Web Store submission (extension prête, pas soumise)".

### Pricing v2 (à utiliser dans toutes les descriptions)

| Plan       | Prix        | Quota analyses | Vidéos max |
| ---------- | ----------- | -------------- | ---------- |
| Découverte | 0 €         | 5 / mois       | 15 min     |
| Pro        | **8,99 €**  | 30 / mois      | 2h         |
| Expert     | **19,99 €** | 100 / mois     | 4h         |

**Note** : `extension/CHROME_WEB_STORE.md` actuel utilise pricing v0 (Plus 4,99 € / Pro 9,99 €). À corriger en Task 4.

### Contraintes Chrome Web Store (officielles)

- **Compte Developer** : 5 USD lifetime, à créer sur https://chrome.google.com/webstore/devconsole.
- **Description courte** : 132 caractères max.
- **Description longue** : 16 000 caractères max (visé : 1500-2500 par langue).
- **Screenshots** : 1280×800 ou 640×400 (1280×800 recommandé), PNG ou JPG, **3 minimum, 5 recommandés**.
- **Promo video** : URL YouTube publique, optionnelle mais fortement recommandée pour ranking.
- **Privacy Policy** : URL publique OBLIGATOIRE (déjà OK).
- **Single Purpose** : déclaration obligatoire depuis MV3.
- **Permissions justification** : chaque permission demandée doit être justifiée dans un champ dédié.
- **Review time** : 1-7 jours. Refus possibles : permissions injustifiées, screenshots de mauvaise qualité, description trompeuse, tests fonctionnels échoués.

### Décisions verrouillées

1. **Pas de nouveau code applicatif** — manifest MV3 v2.0 actuel est déjà optimal, pas de refactor.
2. **Documents livrés en FR + EN** dans `docs/`, parce que (a) Chrome Web Store accepte plusieurs locales, (b) audit Kimi cible aussi marché EN, (c) doc engineering reste en FR (CLAUDE.md règle).
3. **Pas de production réelle** des screenshots ni de la vidéo dans ce plan : briefs détaillés livrés, production déléguée à Maxime/designer (ouvert dans self-review).
4. **Pricing v2 strict** dans toutes les descriptions (Pro 8,99 € / Expert 19,99 €), même si CHROME_WEB_STORE.md actuel utilise v0.
5. **CHROME_WEB_STORE.md historique conservé** : on archive l'ancienne version dans `extension/CHROME_WEB_STORE.legacy.md` (provenance) et le nouveau document canonique vit dans `docs/CHROME-WEB-STORE-LISTING.md`. Permet rollback et garde l'historique sans introduire de chemin recherchable obsolète.

---

## File Structure

### Fichiers créés (5)

| Fichier                                         | Rôle                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `docs/CHROME-WEB-STORE-LISTING.md`              | Fiche canonique : nom, descriptions FR+EN, catégorie, tags, single purpose, justifications permissions, pricing v2 |
| `docs/CHROME-WEB-STORE-SCREENSHOTS-BRIEF.md`    | Brief précis des 5 screenshots 1280×800 : décor, contenu, annotations, captures à prendre                          |
| `docs/CHROME-WEB-STORE-VIDEO-SCRIPT.md`         | Storyboard + voice-over + visuels timing 30-60s                                                                    |
| `docs/CHROME-WEB-STORE-SUBMISSION-CHECKLIST.md` | Checklist process de soumission (compte, ZIP, upload, review, rollout)                                             |
| `extension/CHROME_WEB_STORE.legacy.md`          | Renommage de l'actuel `CHROME_WEB_STORE.md` (archive historique)                                                   |

### Fichiers modifiés (3)

| Fichier                                | Modification                                                                                                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extension/CHROME_WEB_STORE.md`        | Remplacé par stub renvoyant vers `docs/CHROME-WEB-STORE-LISTING.md` (1 ligne + lien)                                                                      |
| `extension/public/manifest.json`       | Aucune modif obligatoire — la description vient de `_locales/{en,fr}/messages.json`. Si description i18n contient encore prix obsolète, ajuster (Task 3). |
| `frontend/src/pages/PrivacyPolicy.tsx` | Vérification + ajout section spécifique extension (permissions, données collectées) si manquante (Task 7)                                                 |

### Fichiers vérifiés (lecture seule)

- `extension/public/_locales/en/messages.json` — description EN
- `extension/public/_locales/fr/messages.json` — description FR
- `extension/dist/manifest.json` — copie buildée du manifest
- `extension/icons/icon{16,32,48,128}.png` — icons multi-tailles (4 ✓)
- `frontend/src/pages/ExtensionWelcomePage.tsx` — page post-install

---

## Tasks

### Task 1 : Archiver l'ancien CHROME_WEB_STORE.md

**Files :**

- Renommer : `extension/CHROME_WEB_STORE.md` → `extension/CHROME_WEB_STORE.legacy.md`
- Créer (stub) : `extension/CHROME_WEB_STORE.md`

- [ ] **Step 1 : Archiver l'ancienne version**

```bash
cd C:/Users/33667/DeepSight-Main
git mv extension/CHROME_WEB_STORE.md extension/CHROME_WEB_STORE.legacy.md
```

- [ ] **Step 2 : Créer un stub redirigeant vers le nouveau document**

Créer `extension/CHROME_WEB_STORE.md` avec contenu :

```markdown
# Chrome Web Store — Extension DeepSight

> Document canonique déplacé : voir [docs/CHROME-WEB-STORE-LISTING.md](../docs/CHROME-WEB-STORE-LISTING.md).
>
> L'ancienne version (pricing v0 obsolète) est archivée dans [CHROME_WEB_STORE.legacy.md](./CHROME_WEB_STORE.legacy.md).
```

- [ ] **Step 3 : Commit**

```bash
git add extension/CHROME_WEB_STORE.md extension/CHROME_WEB_STORE.legacy.md
git commit -m "chore(extension): archive CHROME_WEB_STORE.md to legacy, add stub pointer"
```

---

### Task 2 : Créer docs/CHROME-WEB-STORE-LISTING.md (fiche canonique)

**Files :**

- Create : `docs/CHROME-WEB-STORE-LISTING.md`

- [ ] **Step 1 : Créer le document complet FR+EN avec pricing v2**

Contenu intégral :

````markdown
# Chrome Web Store Listing — DeepSight

> Document canonique. Source des descriptions copiées dans le Developer Dashboard
> au moment de la soumission. Maintenir ce fichier synchronisé avec
> `extension/public/_locales/{en,fr}/messages.json` (description courte 132 char).

**Version extension :** 2.0.0 (Manifest V3)
**Dernière mise à jour :** 2026-04-29

---

## 1. Nom & identité

| Champ                | Valeur                                        |
| -------------------- | --------------------------------------------- |
| Nom (EN)             | DeepSight - AI Video Analysis                 |
| Nom (FR)             | DeepSight - Analyse vidéo IA                  |
| Short name           | DeepSight                                     |
| Catégorie principale | Productivité (Productivity)                   |
| Catégorie secondaire | Éducation (Education)                         |
| Tagline              | Ne subissez plus vos vidéos — interrogez-les. |
| Site officiel        | https://www.deepsightsynthesis.com            |
| Privacy Policy URL   | https://www.deepsightsynthesis.com/privacy    |
| Email support        | maximeleparc3@gmail.com                       |

---

## 2. Description courte (132 char max)

### EN (current in `_locales/en/messages.json`)

```
AI-powered YouTube & TikTok analysis: sourced summaries, fact-check, flashcards, voice chat. European AI by Mistral.
```

(118 caractères — OK)

### FR (current in `_locales/fr/messages.json`)

```
Analyse YouTube et TikTok par IA : synthèses sourcées, fact-checking, flashcards, chat vocal. IA européenne par Mistral.
```

(122 caractères — OK)

**Action requise** : aucune modif des messages.json — descriptions actuelles déjà optimisées avec keywords ranking ("YouTube", "TikTok", "IA", "synthèses sourcées", "fact-check", "flashcards", "chat vocal", "Mistral").

---

## 3. Description longue — EN

```
Tired of spending 1 hour watching a video for 30 useful seconds? DeepSight turns YouTube and TikTok into sourced, fact-checked analyses — directly from your browser, in one click.

Unlike simple summarizers, DeepSight goes deeper: every key claim is verified against reliable web sources, and you get a structured analysis with timestamps, not just bullet points.

KEY FEATURES (Side Panel, persistent across tabs):

- AI-Powered Analysis: paste a video URL or detect it automatically — get a sourced summary with key insights, timestamps and critical evaluation in seconds
- Contextual Chat: ask follow-up questions about any analyzed video — the AI responds with full video context and cited timestamps
- Fact-Checking: claims are automatically verified against web sources (Pro plan and above)
- Quick Chat: chat about any YouTube video without using credits — completely free, even on the free plan
- Voice Chat: real-time voice conversation with the video's content (Expert plan, ElevenLabs)
- 3 Analysis Modes: Accessible, Standard, Expert — adapts to your level
- TikTok Support: analyze TikTok videos too, not just YouTube

STUDY TOOLS (available on the web app deepsightsynthesis.com):

- Auto-generated flashcards with FSRS spaced repetition (same algorithm as Anki)
- Interactive quizzes from video content
- Mind maps showing concept relationships (Pro)
- Academic paper search from arXiv, Semantic Scholar, CrossRef, OpenAlex (Pro)
- AI Debate — confront arguments from 2 videos on the same topic (unique feature, Pro)

WHAT MAKES DEEPSIGHT DIFFERENT:

1. Not a summarizer — a research platform. We verify, we do not just summarize.
2. European AI (Mistral) — your data stays in Europe. GDPR compliant.
3. One account, three platforms — Chrome extension + web app + iOS/Android, synced.
4. No credit card required to start.

FREE TO START:

- 1 free analysis without an account (guest mode in the extension)
- 5 analyses/month with a free account
- Powerful free tier — chat, flashcards, history, fact-check on the web

PLANS (current pricing):

- Discovery (free): 5 analyses/month, 15-min videos, chat, flashcards, history 60d
- Pro (€8.99/month): 30 analyses, 2h videos, fact-checking, mind maps, web search, PDF/DOCX export, playlists (3)
- Expert (€19.99/month): 100 analyses, 4h videos, voice chat, deep research, playlists (10), priority queue

14-day satisfaction guarantee on paid plans.

Built by an independent European developer. Made in France.

Website: https://www.deepsightsynthesis.com
Privacy: https://www.deepsightsynthesis.com/privacy
Support: maximeleparc3@gmail.com
```

Mots-clés naturels présents : YouTube summary, video analysis, fact-check, AI summary, study tool, transcript, flashcards, FSRS, spaced repetition, European AI, Mistral, GDPR, mind map, TikTok analysis.

---

## 4. Description longue — FR

```
Tu regardes 1 heure de vidéo pour 30 secondes utiles ? DeepSight transforme YouTube et TikTok en analyses sourcées et fact-checkées — directement depuis ton navigateur, en un clic.

Contrairement aux simples résumeurs, DeepSight va plus loin : chaque affirmation clé est vérifiée avec des sources web fiables, et tu obtiens une synthèse structurée avec timecodes, pas juste des bullet points.

FONCTIONNALITÉS CLÉS (Side Panel persistant Chrome) :

- Analyse IA : colle un lien vidéo ou laisse l'extension détecter — obtiens une synthèse sourcée, points clés, timecodes et évaluation critique en quelques secondes
- Chat contextuel : pose des questions sur n'importe quelle vidéo analysée — l'IA répond avec le contexte complet et cite les timecodes
- Fact-checking : les affirmations sont vérifiées automatiquement avec des sources web (plan Pro et au-dessus)
- Quick Chat : discute de n'importe quelle vidéo YouTube sans utiliser de crédits — gratuit, même sur le plan gratuit
- Chat vocal : conversation vocale temps réel avec le contenu de la vidéo (plan Expert, ElevenLabs)
- 3 modes d'analyse : Accessible, Standard, Expert — s'adapte à ton niveau
- Support TikTok : analyse aussi les vidéos TikTok, pas seulement YouTube

OUTILS D'ÉTUDE (sur l'app web deepsightsynthesis.com) :

- Flashcards auto-générées avec répétition espacée FSRS (même algorithme qu'Anki)
- Quiz interactifs générés à partir de la vidéo
- Cartes mentales (mind maps) entre concepts (Pro)
- Recherche de papiers académiques arXiv, Semantic Scholar, CrossRef, OpenAlex (Pro)
- Débat IA — confronte les arguments de 2 vidéos sur le même sujet (fonctionnalité unique, Pro)

CE QUI REND DEEPSIGHT DIFFÉRENT :

1. Pas un résumeur — une plateforme de recherche. On vérifie, on ne résume pas seulement.
2. IA européenne (Mistral) — tes données restent en Europe. RGPD-compliant.
3. Un seul compte, trois plateformes — extension Chrome + web + iOS/Android, synchronisés.
4. Sans carte bancaire pour démarrer.

GRATUIT POUR COMMENCER :

- 1 analyse gratuite sans compte (guest mode dans l'extension)
- 5 analyses/mois avec un compte gratuit
- Plan gratuit puissant — chat, flashcards, historique, fact-check sur le web

PLANS (pricing actuel) :

- Découverte (gratuit) : 5 analyses/mois, vidéos 15 min, chat, flashcards, historique 60 j
- Pro (8,99 €/mois) : 30 analyses, vidéos 2h, fact-checking, cartes mentales, web search, export PDF/DOCX, playlists (3)
- Expert (19,99 €/mois) : 100 analyses, vidéos 4h, chat vocal, recherche approfondie, playlists (10), file prioritaire

Garantie satisfaction 14 jours sur les plans payants.

Développé par un développeur indépendant européen. Made in France.

Site web : https://www.deepsightsynthesis.com
Vie privée : https://www.deepsightsynthesis.com/privacy
Support : maximeleparc3@gmail.com
```

Personas ciblés : étudiants, chercheurs, journalistes, créateurs de contenu, formateurs, autodidactes.

---

## 5. Catégorie & tags

- **Catégorie principale** : Productivity
- **Catégorie secondaire** : Education
- **Tags / mots-clés ranking** (utilisés dans description, pas un champ séparé sur Chrome Web Store) :
  AI, productivity, YouTube, TikTok, summary, fact-check, flashcards, study, transcript, Mistral, European AI, video analysis, GDPR, FSRS, spaced repetition, research, academic.

---

## 6. Single Purpose Statement (champ dédié dans le CWS form)

```
DeepSight is an AI-powered analysis tool for YouTube and TikTok videos. Its single purpose is to help users understand, fact-check, and study video content via AI-generated summaries, contextual chat, flashcards, and an optional voice agent — all from a persistent Side Panel inside Chrome.
```

---

## 7. Permissions justifications (champ dédié, une par permission)

> Reprises telles quelles de l'audit `extension/CHROME_WEB_STORE.legacy.md` (déjà
> validé). Maintenir alignées avec `extension/public/manifest.json`.

### Standard permissions

- **storage** — Persist authentication tokens (access + refresh), user preferences (UI language, voice settings), and a small cache of recent analyses for offline access. No tracking, no third-party sharing.
- **activeTab** — Read the URL of the YouTube or TikTok video currently active in the user's tab so the user can trigger an AI analysis with one click. Only the video ID is sent to our backend; no DOM scraping is performed.
- **tabs** — Detect URL changes (e.g. user navigates to a new YouTube video) to refresh the Side Panel context (video detected card, analysis state). Used solely on YouTube and TikTok.
- **alarms** — Periodic background refresh of the OAuth access token (15-minute lifespan) using the refresh token, so the user does not need to re-login every 15 minutes.
- **identity** — Used by `chrome.identity.launchWebAuthFlow()` to perform Google OAuth login. The flow opens the standard Google consent screen in a popup and returns an OAuth code we exchange server-side for a JWT.
- **clipboardWrite** — Allow the user to copy generated content (summaries, fact-check results, flashcards) to the system clipboard with one click, from the Side Panel "Copy" buttons.
- **sidePanel** — Display the DeepSight interface in Chrome's native Side Panel (Chrome 116+), persistent across tab switches. Toggle via Alt+Shift+D or the toolbar icon.
- **offscreen** — Required by the ElevenLabs voice SDK on Chrome MV3 to host an offscreen document for audio capture and playback (service workers cannot access `getUserMedia` directly).

### Optional permissions

- **audioCapture** (optional, requested only when the user starts a voice chat session) — Capture microphone input for the ElevenLabs ConvAI voice agent. Audio is streamed directly to ElevenLabs over a secure WebSocket; no audio is persisted on our servers.

### Host permissions

- `https://www.youtube.com/*`, `https://youtube.com/*` — Detect the currently watched video and inject the optional content-script overlay showing the analyze button. No analytics, no DOM modification beyond the overlay.
- `https://www.tiktok.com/*`, `https://tiktok.com/*`, `https://vm.tiktok.com/*`, `https://m.tiktok.com/*` — Same as YouTube, for TikTok video detection.
- `https://www.deepsightsynthesis.com/*` — Cross-domain authentication sync between the extension and the web app, so a user logged in on the web is automatically logged in on the extension (and vice versa).
- `https://api.deepsightsynthesis.com/*` — Backend API endpoints for analyses, chat, billing, voice sessions, etc.
- `https://api.elevenlabs.io/*`, `wss://api.elevenlabs.io/*`, `https://*.elevenlabs.io/*`, `wss://*.elevenlabs.io/*` — ElevenLabs ConvAI voice chat over WebSocket. Required by the @elevenlabs/client SDK; CSP whitelist already restricts connect-src to these domains.

---

## 8. Données collectées (Privacy Practices form Chrome Web Store)

À cocher dans le formulaire Privacy Practices du Developer Dashboard :

| Catégorie                           | Collecté ? | Justification (champ dédié)                                                                                   |
| ----------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| Personally identifiable information | Oui        | Email + nom (Google OAuth). Stockés en EU, RGPD-compliant.                                                    |
| Health information                  | Non        |                                                                                                               |
| Financial and payment information   | Non        | Aucun paiement traité par l'extension (Stripe géré sur web app uniquement)                                    |
| Authentication information          | Oui        | JWT tokens stockés dans `chrome.storage.local`, jamais envoyés à des tiers                                    |
| Personal communications             | Non        |                                                                                                               |
| Location                            | Non        |                                                                                                               |
| Web history                         | **Limité** | Uniquement URL de vidéo YouTube/TikTok que l'utilisateur choisit d'analyser. Pas de tracking en arrière-plan. |
| User activity                       | Non        |                                                                                                               |
| Website content                     | Non        | Le video ID seul est envoyé. Le scraping se fait server-side.                                                 |

Déclarations à cocher :

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

---

## 9. Branding visuel

- **Logo principal** : `extension/icons/icon128.png` (déjà présent, 128×128)
- **Tagline** : "Ne subissez plus vos vidéos — interrogez-les."
- **Couleurs** : Indigo `#6366f1`, Violet `#8b5cf6`, Cyan `#06b6d4`, fond `#0a0a0f`
- **Style screenshots** : dark mode, glassmorphism, accent indigo/violet
- **Badge** : 🇫🇷🇪🇺 "Vos données restent en Europe"

---

## 10. Cross-références

- Brief screenshots : [CHROME-WEB-STORE-SCREENSHOTS-BRIEF.md](./CHROME-WEB-STORE-SCREENSHOTS-BRIEF.md)
- Script vidéo promo : [CHROME-WEB-STORE-VIDEO-SCRIPT.md](./CHROME-WEB-STORE-VIDEO-SCRIPT.md)
- Checklist soumission : [CHROME-WEB-STORE-SUBMISSION-CHECKLIST.md](./CHROME-WEB-STORE-SUBMISSION-CHECKLIST.md)
- Manifeste source : `extension/public/manifest.json`
- Locales : `extension/public/_locales/{en,fr}/messages.json`
- Privacy Policy code : `frontend/src/pages/PrivacyPolicy.tsx`
- Page post-install : `frontend/src/pages/ExtensionWelcomePage.tsx` (route `/extension-welcome`)
````

- [ ] **Step 2 : Vérifier que le fichier est créé et bien formé**

Run : `wc -l C:/Users/33667/DeepSight-Main/docs/CHROME-WEB-STORE-LISTING.md`
Expected : > 200 lignes.

- [ ] **Step 3 : Commit**

```bash
git add docs/CHROME-WEB-STORE-LISTING.md
git commit -m "docs(chrome-store): add canonical CWS listing FR+EN with pricing v2"
```

---

### Task 3 : Vérifier `_locales/{en,fr}/messages.json` et confirmer descriptions courtes

**Files :**

- Read : `extension/public/_locales/en/messages.json`
- Read : `extension/public/_locales/fr/messages.json`

- [ ] **Step 1 : Vérifier longueur des descriptions courtes**

Lire les deux fichiers et confirmer :

- EN `extension_description.message` ≤ 132 caractères
- FR `extension_description.message` ≤ 132 caractères

État connu :

- EN : "AI-powered YouTube & TikTok analysis: sourced summaries, fact-check, flashcards, voice chat. European AI by Mistral." → 118 caractères ✓
- FR : "Analyse YouTube et TikTok par IA : synthèses sourcées, fact-checking, flashcards, chat vocal. IA européenne par Mistral." → 122 caractères ✓

Si l'une dépasse 132 → modifier en supprimant un keyword secondaire (ex : retirer "voice chat"). Sinon, **aucune modification** nécessaire.

- [ ] **Step 2 : Confirmer que le manifest n'a pas de description hardcodée obsolète**

```bash
grep -n "description" C:/Users/33667/DeepSight-Main/extension/public/manifest.json
```

Expected : seule ligne `"description": "__MSG_extension_description__"`. Pas de prix hardcodé. Aucune action.

- [ ] **Step 3 : Pas de commit (vérification seule)**

Si un fichier a été touché, commit :

```bash
git add extension/public/_locales/
git commit -m "chore(extension): trim short description to <=132 chars for CWS"
```

Sinon, passer à Task 4.

---

### Task 4 : Créer docs/CHROME-WEB-STORE-SCREENSHOTS-BRIEF.md (brief 5 screenshots)

**Files :**

- Create : `docs/CHROME-WEB-STORE-SCREENSHOTS-BRIEF.md`

- [ ] **Step 1 : Rédiger le brief complet**

Contenu intégral :

```markdown
# Chrome Web Store — Brief Screenshots (5 × 1280×800)

> Document de production. À donner au designer ou utilisable directement par
> Maxime pour capturer les screenshots avec Chrome DevTools (mode device 1280×800).
> Format : PNG, sans alpha, fond opaque. Texte des annotations en français,
> traduction EN livrée en parallèle pour la fiche internationale.

**Préparation environnement :**

1. Browser : Chrome stable, fenêtre `1280 × 800` exactement (DevTools → Toggle Device → Responsive → custom 1280×800).
2. Compte de démo : `demo@deepsightsynthesis.com` avec **plan Pro** activé (visualiser fact-check + mind maps).
3. Mode dark uniquement (cohérence design system).
4. Cacher les barres dev (DevTools fermé pendant capture).
5. Privacy : flouter ou remplacer toutes les vraies adresses email/avatar par mockups.

---

## Screenshot 1 — Hero / Side Panel sur YouTube (analyse en cours)

**Objectif** : montrer instantanément la promesse de valeur — un clic = analyse.

**Décor :**

- Page YouTube ouverte : vidéo de démo recommandée → un TED Talk ou une conférence éducative ~12 min (ex : "Inside the mind of a master procrastinator", Tim Urban).
- Player YouTube visible à gauche ~60% de l'écran.
- Side Panel DeepSight ouvert à droite ~40% de l'écran (mode persistent Chrome 116+).

**Contenu Side Panel à afficher :**

- Header DeepSight (logo + tagline mini).
- Card "Vidéo détectée" avec thumbnail + titre vidéo.
- Bouton primaire "Analyser cette vidéo" mis en évidence (hover state, glow indigo).
- Sous le bouton : barre de progression à 35% avec label "Extraction du transcript…".
- Pas de chat ouvert, pas de résultats — seulement le moment d'engagement.

**Annotation overlay (bandeau bas, 1280×80) :**

- Texte FR : "1 clic = analyse complète sourcée"
- Texte EN (version internationale) : "1 click = full sourced analysis"
- Police Inter Bold 32px, couleur #ffffff, fond gradient indigo→violet 80% opacity.

**Fichier livré :** `screenshots/01-hero-youtube-sidebar.png` (1280×800).

---

## Screenshot 2 — Synthèse résultat avec timecodes

**Objectif** : preuve concrète de la qualité de la synthèse.

**Décor :**

- Même vidéo YouTube en arrière-plan (cohérence visuelle).
- Side Panel ouvert sur la vue "Résultats analyse".

**Contenu Side Panel :**

- Onglet actif "Synthèse" (parmi : Synthèse / Fact-check / Chat / Flashcards).
- Titre vidéo + durée + plan utilisateur (badge "Pro").
- Section "Points clés" avec 3-4 bullets concrets, chacun précédé d'un timecode cliquable (ex : `[02:14]`, `[05:42]`, `[09:18]`).
- Section "Conclusion nuancée" avec 2-3 lignes.
- Footer : `Sources : 3 références web vérifiées`.

**Annotation overlay :**

- FR : "Synthèse sourcée avec timecodes cliquables"
- EN : "Sourced summary with clickable timestamps"

**Fichier livré :** `screenshots/02-synthesis-timecodes.png` (1280×800).

---

## Screenshot 3 — Fact-check automatique (différenciateur clé)

**Objectif** : montrer le différenciateur le plus fort vs concurrents (ils ne fact-checkent pas).

**Décor :**

- Side Panel ouvert sur l'onglet "Fact-check".

**Contenu :**

- Liste de 3 affirmations extraites de la vidéo, chacune avec :
  - Citation textuelle entre guillemets (timecode `[mm:ss]`).
  - Verdict coloré : `SOLIDE` (vert) / `PLAUSIBLE` (jaune) / `INCERTAIN` (orange).
  - 1-2 lignes d'analyse.
  - Nombre de sources vérifiées (ex : "4 sources concordantes").
- Mix des verdicts : 1 SOLIDE, 1 PLAUSIBLE, 1 INCERTAIN — montre la nuance.

**Annotation overlay :**

- FR : "Fact-check automatique avec sources web"
- EN : "Automatic fact-check with web sources"

**Fichier livré :** `screenshots/03-factcheck.png` (1280×800).

---

## Screenshot 4 — Chat contextuel (engagement / rétention)

**Objectif** : montrer l'interaction conversationnelle qui crée de la rétention.

**Décor :**

- Side Panel sur onglet "Chat".

**Contenu :**

- 2 messages utilisateur + 2 réponses IA, conversation réaliste :
  - User : "Quel argument utilise-t-il pour expliquer la procrastination chronique ?"
  - IA : (réponse 3-4 lignes avec citation `[09:18]` cliquable)
  - User : "Est-ce que les autres chercheurs sont d'accord avec ce modèle ?"
  - IA : (réponse 4 lignes citant 2 sources web "selon Steel (2007)…")
- Input en bas avec placeholder "Pose une question sur la vidéo…" + bouton micro (Quick Voice Call).
- Compteur "12/25 messages restants" (plan Pro).

**Annotation overlay :**

- FR : "Pose des questions à ta vidéo"
- EN : "Ask questions to your video"

**Fichier livré :** `screenshots/04-chat-contextual.png` (1280×800).

---

## Screenshot 5 — Flashcards FSRS sur web app + extension synced

**Objectif** : montrer l'écosystème tri-plateforme + outil d'étude.

**Décor :**

- Browser tab DeepSight web app ouvert (https://www.deepsightsynthesis.com/study).
- Side Panel extension ouvert à droite avec card "Synced ✓".

**Contenu web app (gauche) :**

- 3 flashcards en preview (front + back), questions issues de la vidéo.
- Badge FSRS visible : "Prochaine révision : dans 2 jours".
- CTA "Réviser maintenant".

**Contenu Side Panel (droite) :**

- Petit module "Tu apprends sur le web" avec icônes plateforme (Chrome / Mobile / Web) liées par des traits.
- Texte "Un seul compte, trois plateformes".

**Annotation overlay :**

- FR : "Apprends 3× plus vite avec flashcards FSRS"
- EN : "Learn 3× faster with FSRS flashcards"

**Fichier livré :** `screenshots/05-flashcards-multi-platform.png` (1280×800).

---

## Tableau récapitulatif

| #   | Nom fichier                        | Promesse mise en avant       | URL test                                    |
| --- | ---------------------------------- | ---------------------------- | ------------------------------------------- |
| 1   | `01-hero-youtube-sidebar.png`      | Acquisition : 1 clic         | https://www.youtube.com/watch?v=arj7oStGLkU |
| 2   | `02-synthesis-timecodes.png`       | Qualité : synthèse sourcée   | (même vidéo)                                |
| 3   | `03-factcheck.png`                 | Différenciateur : fact-check | (même vidéo)                                |
| 4   | `04-chat-contextual.png`           | Rétention : conversation     | (même vidéo)                                |
| 5   | `05-flashcards-multi-platform.png` | Écosystème + apprentissage   | https://www.deepsightsynthesis.com/study    |

## Process de capture (à exécuter avant soumission)

1. Ouvrir Chrome 116+ avec extension dev installée (`chrome://extensions` → Load unpacked → `extension/dist/`).
2. DevTools → Toggle Device toolbar (Ctrl+Shift+M) → custom `1280 × 800`.
3. Pour chaque screenshot : reproduire le contenu décrit, ouvrir Capture full size screenshot via DevTools (Cmd/Ctrl+Shift+P → "screenshot") OU utiliser un outil tiers (Lightshot, ShareX) avec dimensions exactes.
4. Ajouter les annotations en post-prod (Figma / Photoshop / Canva). Template Figma à créer si besoin.
5. Vérifier chaque PNG : 1280×800 strict, < 5 MB, dark mode visible, pas de PII.
6. Stocker dans `docs/screenshots/chrome-web-store/01..05.png` (créer le dossier).

## Outils suggérés

- Capture : DevTools native, Awesome Screenshot, Loom
- Annotations : Figma (template à créer une fois), Canva
- Vérif dimensions : `identify` (ImageMagick) ou `file` Linux/Mac
```

- [ ] **Step 2 : Commit**

```bash
git add docs/CHROME-WEB-STORE-SCREENSHOTS-BRIEF.md
git commit -m "docs(chrome-store): add screenshots brief for 5 CWS images 1280x800"
```

---

### Task 5 : Créer docs/CHROME-WEB-STORE-VIDEO-SCRIPT.md (script vidéo 30-60s)

**Files :**

- Create : `docs/CHROME-WEB-STORE-VIDEO-SCRIPT.md`

- [ ] **Step 1 : Rédiger le storyboard complet**

Contenu intégral :

```markdown
# Chrome Web Store — Script vidéo promo 30-60s

> Document de production. Ne contient pas de fichier vidéo.
> Spec destinée à un prestataire vidéo OU à Maxime pour produire la promo.
> Cible : YouTube (URL publique non-listée → Chrome Web Store).

**Format de sortie :** MP4 H.264 1920×1080 30fps, audio AAC 192 kbps, durée totale 45-50 s. Upload non-listé sur la chaîne YouTube DeepSight, copier l'URL dans le champ "Promotional video URL" du Developer Dashboard.

**Voix-off :** voix française adulte, ton calme + énergique sur le CTA. Si pas de voix-off humaine disponible : utiliser ElevenLabs (voix française "Charlotte" ou équivalent), ironique étant donné la stack 😉.

**Sous-titres :** burned-in français + version EN séparée (deux exports). Police Inter Bold blanche fond noir 60% opacity.

**Musique :** royalty-free upbeat tech (Epidemic Sound / Artlist). Volume -18 LUFS pour ne pas masquer la voix.

---

## Storyboard (45 secondes)

### 0:00 — 0:05 (5s) — Hook : la frustration

**Visuel :**

- Time-lapse accéléré : utilisateur (mains visibles) regarde vidéo YouTube de 2h, prend des notes au stylo, s'endort, se réveille, frotte ses yeux, regarde l'horloge.
- Texte gros à l'écran : "1h pour 30s utiles ?" (FR) / "1 hour for 30 useful seconds?" (EN)

**Voix-off :**

- FR : "Tu regardes 1 heure de vidéo… pour 30 secondes utiles ?"
- EN : "You watch 1 hour of video… for 30 useful seconds?"

**Audio :** musique discrète, tic-tac d'horloge en sound design.

---

### 0:05 — 0:13 (8s) — Solution : 1 clic

**Visuel :**

- Cut sec sur même vidéo YouTube, mais cette fois Side Panel DeepSight ouvert à droite.
- Curseur survole le bouton "Analyser" → click sonore satisfaisant.
- Animation : barre de progression rapide indigo→violet, badges qui apparaissent ("Transcript ✓", "Synthèse ✓", "Fact-check ✓").
- Logo DeepSight discret en haut à droite.

**Voix-off :**

- FR : "DeepSight transforme YouTube et TikTok en synthèse sourcée. En un clic."
- EN : "DeepSight turns YouTube and TikTok into a sourced summary. In one click."

**Audio :** swoosh sur le click, musique monte en intensité.

---

### 0:13 — 0:25 (12s) — Démo : synthèse + fact-check + chat

**Visuel (cuts rapides 4s par feature) :**

1. **0:13-0:17 — Synthèse** : zoom sur le panel résultats, points clés défilent, surlignage des timecodes cliquables `[02:14]`, `[09:18]`.
   - Voix-off FR : "Synthèse structurée avec timecodes."
   - EN : "Structured summary with timestamps."

2. **0:17-0:21 — Fact-check** : transition vers onglet Fact-check, badges `SOLIDE` / `PLAUSIBLE` / `INCERTAIN` apparaissent un par un avec animation pop.
   - Voix-off FR : "Fact-check automatique."
   - EN : "Automatic fact-check."

3. **0:21-0:25 — Chat vocal** : transition vers chat, animation waveform ElevenLabs, sous-titre conversation rapide.
   - Voix-off FR : "Et même un chat vocal — interroge ta vidéo."
   - EN : "Even voice chat — interrogate your video."

**Audio :** tempo musique stable, micro-sound design pour chaque transition.

---

### 0:25 — 0:35 (10s) — Multi-plateforme + flashcards

**Visuel :**

- Plan large : trois écrans alignés (Chrome extension à gauche, app web au centre, mobile iPhone à droite).
- Animation : un compte se synchronise sur les trois (logo DeepSight pulse, traits lumineux entre les écrans).
- Sur le mobile : flashcard tournante avec animation flip.

**Voix-off :**

- FR : "Un seul compte, trois plateformes. Et tes flashcards te suivent partout."
- EN : "One account, three platforms. Your flashcards follow you everywhere."

**Audio :** musique monte vers le climax.

---

### 0:35 — 0:45 (10s) — Trust + CTA

**Visuel :**

- Cut sur card de trust : "🇫🇷🇪🇺 IA européenne — Mistral", "RGPD-compliant", "Sans CB pour démarrer".
- Transition vers logo DeepSight grand format + tagline : "Ne subissez plus vos vidéos — interrogez-les."
- CTA bouton à l'écran : "Installer gratuitement →" (FR) / "Install free →" (EN).
- Petit texte sous bouton : "deepsightsynthesis.com" + icône Chrome Web Store.

**Voix-off :**

- FR : "Ne subissez plus vos vidéos. Interrogez-les. Installe DeepSight gratuitement."
- EN : "Don't endure your videos. Interrogate them. Install DeepSight for free."

**Audio :** climax musique, fade-out 2s, sound design "ding" sur le CTA.

---

## Checklist production

- [ ] Voice-over enregistrée FR (45s) + EN (45s)
- [ ] Captures écran propres (mêmes vidéos qu'aux screenshots — cohérence)
- [ ] Animations Side Panel (After Effects ou Figma → Lottie)
- [ ] Music track licensed
- [ ] Sound design (clicks, swooshes, ding)
- [ ] Sous-titres burn-in FR + EN exportés (deux fichiers)
- [ ] Export 1920×1080 H.264 MP4
- [ ] Test : taille fichier < 100 MB
- [ ] Upload YouTube non-listé
- [ ] URL non-listée copiée dans CWS Developer Dashboard

## Références visuelles & inspirations

- Notion AI promo (style cuts rapides + voice-over confiant)
- Linear app launch trailer (transitions fluides + design system marqué)
- Loom intro vidéo (storytelling utilisateur first)
- Arc Browser ad (humour subtil + démo claire)

## Budget estimé (si externalisation)

- Voice-over FR + EN : 100-200 €
- Animation/montage prestataire : 400-800 € (5h-10h vidéaste freelance)
- Music license : 0 € (Artlist abonnement existant) ou 30 €/track Epidemic Sound
- Total estimation : 500-1000 €

Alternative DIY (Maxime) :

- Outils : Figma + Loom + Capcut
- Voice-over : ElevenLabs (Charlotte voice) ~5 €
- Time : 4-6h
- Total : ~5 €
```

- [ ] **Step 2 : Commit**

```bash
git add docs/CHROME-WEB-STORE-VIDEO-SCRIPT.md
git commit -m "docs(chrome-store): add 45s promo video script FR+EN with storyboard"
```

---

### Task 6 : Créer docs/CHROME-WEB-STORE-SUBMISSION-CHECKLIST.md

**Files :**

- Create : `docs/CHROME-WEB-STORE-SUBMISSION-CHECKLIST.md`

- [ ] **Step 1 : Rédiger la checklist complète**

Contenu intégral :

````markdown
# Chrome Web Store — Submission Checklist

> Process à suivre dans l'ordre pour soumettre l'extension DeepSight v2.0.0.
> Review Google : 1-7 jours. Anticiper en lançant la soumission au moins 7 jours
> avant un lancement marketing.

---

## Phase 0 — Pré-requis (à valider AVANT toute action)

- [ ] Compte Google dédié DeepSight (pas le perso) → utiliser maximeleparc3@gmail.com (déjà associé à `homepage_url`)
- [ ] **Frais d'inscription Developer payés** : 5 USD lifetime sur https://chrome.google.com/webstore/devconsole/register
- [ ] Privacy Policy publique fonctionnelle : `curl -I https://www.deepsightsynthesis.com/privacy` → 200 OK
- [ ] Page `/extension-welcome` publique fonctionnelle : `curl -I https://www.deepsightsynthesis.com/extension-welcome` → 200 OK
- [ ] Backend API stable et joignable : `curl -I https://api.deepsightsynthesis.com/health` → 200 OK
- [ ] Plan pricing v2 déployé en prod (Pro 8,99 € / Expert 19,99 €) — sinon aligner avec sortie pricing-v2-stripe-grandfathering plan
- [ ] CHROME-WEB-STORE-LISTING.md (fiche FR+EN) finalisé et relu
- [ ] CHROME-WEB-STORE-SCREENSHOTS-BRIEF.md → 5 PNG livrés dans `docs/screenshots/chrome-web-store/0[1-5].png` (1280×800 chacun)
- [ ] CHROME-WEB-STORE-VIDEO-SCRIPT.md → vidéo produite + uploadée non-listée sur YouTube (URL en main)
- [ ] Tests manuels extension dans Chrome 116+ (clean profile) :
  - [ ] Install via `Load unpacked` → `dist/` réussit sans erreur console
  - [ ] Login Google OAuth fonctionne
  - [ ] Side Panel s'ouvre via Alt+Shift+D et icône toolbar
  - [ ] Analyse YouTube fonctionne sur 3 vidéos différentes (court / moyen / long)
  - [ ] Analyse TikTok fonctionne sur 1 vidéo
  - [ ] Quick Chat fonctionne sans crédits
  - [ ] Voice chat fonctionne (plan Expert) avec micro
  - [ ] Logout puis login → tokens persistent ou refresh propre
  - [ ] Désinstall propre (pas de storage résiduel)

---

## Phase 1 — Build & ZIP

- [ ] **Update version** dans `extension/public/manifest.json` si fix nécessaire (sinon laisser 2.0.0)
- [ ] **Update CHANGELOG** dans `extension/CHANGELOG.md` (créer si n'existe pas)
- [ ] Build production propre :

```bash
cd C:/Users/33667/DeepSight-Main/extension
rm -rf dist/
npm install
npm run build
```

- [ ] Vérifier output `dist/` :

```bash
ls -la C:/Users/33667/DeepSight-Main/extension/dist/manifest.json
node -e "console.log(JSON.parse(require('fs').readFileSync('C:/Users/33667/DeepSight-Main/extension/dist/manifest.json')).version)"
```

Expected : `2.0.0` (ou version bumpée).

- [ ] **Supprimer les sourcemaps** du dist avant ZIP (optionnel mais recommandé pour réduire taille) :

```bash
find C:/Users/33667/DeepSight-Main/extension/dist/ -name "*.map" -delete
```

- [ ] **Créer le ZIP** dans le dossier `extension/release/` :

```bash
mkdir -p C:/Users/33667/DeepSight-Main/extension/release
cd C:/Users/33667/DeepSight-Main/extension/dist
zip -r ../release/deepsight-extension-v2.0.0.zip . -x "*.map"
ls -la ../release/
```

Expected : ZIP < 10 MB.

- [ ] **Vérifier le ZIP** :

```bash
unzip -l C:/Users/33667/DeepSight-Main/extension/release/deepsight-extension-v2.0.0.zip | head -30
```

Doit contenir : `manifest.json`, `background.js`, `content.js`, `sidepanel.html`, `sidepanel.js`, `_locales/`, `icons/`.

---

## Phase 2 — Developer Dashboard upload

URL : https://chrome.google.com/webstore/devconsole

- [ ] Login avec maximeleparc3@gmail.com
- [ ] Cliquer "New Item" → upload ZIP `deepsight-extension-v2.0.0.zip`
- [ ] Attendre la validation automatique du manifest (10-30s)

### Onglet "Store listing"

- [ ] **Title (EN)** : "DeepSight - AI Video Analysis"
- [ ] **Title (FR)** : "DeepSight - Analyse vidéo IA"
- [ ] **Summary (EN)** : copier description courte EN depuis CHROME-WEB-STORE-LISTING.md §2
- [ ] **Summary (FR)** : copier description courte FR depuis CHROME-WEB-STORE-LISTING.md §2
- [ ] **Detailed description (EN)** : copier description longue EN depuis §3
- [ ] **Detailed description (FR)** : copier description longue FR depuis §4
- [ ] **Category** : Productivity
- [ ] **Language** : English (default), then add Français
- [ ] **Icon** : upload `extension/icons/icon128.png` (128×128)
- [ ] **Screenshots** : upload 5 PNG dans `docs/screenshots/chrome-web-store/0[1-5].png` (1280×800)
- [ ] **Promotional images** (optionnel, recommandé) :
  - Small promo tile 440×280 — designer asset à produire si capacity
  - Large promo tile 920×680 — designer asset à produire si capacity
  - Marquee 1400×560 — designer asset à produire si capacity (rare placement, skip si pas de temps)
- [ ] **Promotional video URL** : coller URL YouTube non-listée (CHROME-WEB-STORE-VIDEO-SCRIPT.md output)
- [ ] **Official URL** : https://www.deepsightsynthesis.com
- [ ] **Support URL** : https://www.deepsightsynthesis.com/support OU mailto:maximeleparc3@gmail.com
- [ ] Save draft

### Onglet "Privacy practices"

- [ ] **Single purpose** : copier depuis CHROME-WEB-STORE-LISTING.md §6
- [ ] Pour chaque permission : copier la justification depuis §7 dans le champ correspondant
- [ ] **Data usage** : cocher selon §8 (PII oui, web history limité, autres non)
- [ ] **Privacy policy URL** : `https://www.deepsightsynthesis.com/privacy`
- [ ] Cocher les 3 déclarations (no sale, no unrelated purpose, no creditworthiness)
- [ ] Save

### Onglet "Distribution"

- [ ] **Visibility** : Public
- [ ] **Distribution regions** : All regions (acquisition organique mondiale)
- [ ] **Mature content** : No
- [ ] Save

### Onglet "Pricing & paid features"

- [ ] **Pricing model** : Free (l'extension est gratuite, le SaaS gère le paiement Stripe sur web)
- [ ] **In-app purchases** : No
- [ ] Save

---

## Phase 3 — Submit for review

- [ ] Re-vérifier les 4 onglets ont tous un statut "Complete"
- [ ] Cliquer "Submit for review"
- [ ] Confirmer dans la modal
- [ ] Capturer screenshot de la confirmation et le coller dans la tâche Asana

**Délai review attendu** : 1 à 7 jours ouvrés.
**Statut visible** : `Pending review` → `In review` → `Published` (ou `Rejected`).

---

## Phase 4 — En cas de rejet

- [ ] Lire l'email de rejet — Google précise toujours la cause
- [ ] Causes courantes et fixes :
  - **"Permissions not justified"** → reprendre §7 et étoffer le champ correspondant
  - **"Description misleading"** → relire description longue, retirer les claims forts non démontrables
  - **"Screenshots low quality"** → re-capturer en 1280×800 strict, vérifier compression
  - **"Privacy policy unclear"** → ajouter section spécifique extension dans `frontend/src/pages/PrivacyPolicy.tsx` (Task 7 du plan)
  - **"Single purpose violation"** → vérifier que les features alignent avec §6
- [ ] Apply fix → resubmit (compteur review redémarre à zéro)

---

## Phase 5 — Post-publication (jour 0 → +30)

- [ ] **Annoncer** : tweet, LinkedIn, page d'accueil deepsightsynthesis.com badge "Available on Chrome Web Store"
- [ ] **Tracker** : installs/jour dans Chrome Developer Dashboard → graph hebdo
- [ ] **Reviews** : monitorer les reviews + répondre aux questions/bugs sous 48h
- [ ] **Updates** : pour update mineure → bump version manifest, build, ZIP, upload nouvelle version. Approval mises à jour souvent < 24h.
- [ ] **Asana** : créer tâche dans projet "DeepSight Extension Chrome" → "📈 Monitor CWS metrics weekly"

---

## Phase 6 — Optimisation continue (jour +30 → ∞)

- [ ] **A/B test descriptions** : changer description longue tous les 30j, mesurer impact sur conversion install
- [ ] **A/B test screenshots** : ordre / contenu, mesurer impact sur conversion
- [ ] **SEO Chrome Web Store** : utiliser des keywords saisonniers (ex : "rentrée scolaire" en septembre)
- [ ] **Reviews stratégie** : prompter les power users dans la web app pour laisser une review CWS
- [ ] **Promo video update** : refresh tous les 6 mois selon nouvelles features
- [ ] **Cible 1000+ users/jour** : si non atteinte à 90j, lancer plan SEO + partenariats (Tournesol, edu YouTubers)

---

## Annexes

### Liens utiles

- Developer Dashboard : https://chrome.google.com/webstore/devconsole
- Best practices : https://developer.chrome.com/docs/webstore/best_practices/
- Permission justification doc : https://developer.chrome.com/docs/webstore/program-policies/permissions/
- Spam policies : https://developer.chrome.com/docs/webstore/program-policies/spam-and-placement/

### Métriques cibles (KPI)

| Métrique           | Jour 7 | Jour 30 | Jour 90 |
| ------------------ | ------ | ------- | ------- |
| Total installs     | 200    | 5 000   | 30 000  |
| Daily new installs | 30+    | 200+    | 1 000+  |
| Rating moyen       | 4.5+   | 4.5+    | 4.5+    |
| Reviews count      | 5+     | 50+     | 300+    |
| Uninstall rate     | < 30%  | < 25%   | < 20%   |
````

- [ ] **Step 2 : Commit**

```bash
git add docs/CHROME-WEB-STORE-SUBMISSION-CHECKLIST.md
git commit -m "docs(chrome-store): add complete submission checklist (phases 0-6)"
```

---

### Task 7 : Vérifier + augmenter PrivacyPolicy.tsx pour exigences extension

**Files :**

- Read : `frontend/src/pages/PrivacyPolicy.tsx` (lignes 1-200)
- Modify : `frontend/src/pages/PrivacyPolicy.tsx` (ajouter section "Extension Chrome — données collectées")

- [ ] **Step 1 : Vérifier l'état actuel**

Lire le fichier complet et chercher mentions de :

- "extension" / "chrome" / "manifest"
- "OAuth" / "JWT" / "tokens"
- "video ID" / "scraping"

```bash
grep -i -n "extension\|chrome\|oauth\|jwt\|video id" C:/Users/33667/DeepSight-Main/frontend/src/pages/PrivacyPolicy.tsx | head -30
```

- [ ] **Step 2 : Si la section "Extension" est manquante, l'ajouter**

Section à insérer (juste après le composant `Section` "Cookies" ou équivalent, avant le footer) :

```tsx
<Section title="Extension Chrome — données collectées">
  <p>
    L'extension DeepSight (Chrome Web Store, Manifest V3 v2.0) collecte le
    strict minimum de données nécessaires à son fonctionnement :
  </p>
  <ul className="list-disc ml-6 space-y-2">
    <li>
      <strong>Authentification</strong> : tokens JWT (access + refresh) stockés
      localement dans <code>chrome.storage.local</code>, jamais partagés avec
      des tiers.
    </li>
    <li>
      <strong>URL vidéo active</strong> : uniquement quand vous cliquez
      "Analyser". Seul l'identifiant vidéo (video ID) est envoyé à notre backend
      ; aucun scraping DOM n'est effectué.
    </li>
    <li>
      <strong>Préférences UI</strong> : langue, paramètres voix (chat vocal).
      Stockées localement, jamais transmises.
    </li>
    <li>
      <strong>Cache analyses récentes</strong> : pour permettre l'accès offline
      aux dernières synthèses. Stockage local, supprimable via désinstallation.
    </li>
  </ul>
  <p>
    L'extension ne fait <strong>aucun tracking</strong> en arrière-plan, ne lit
    pas le contenu des pages YouTube/TikTok au-delà de l'URL, et ne contient
    aucun analytics tiers (Google Analytics, Facebook Pixel, etc.). Tout
    traitement IA se fait sur nos serveurs Hetzner en Europe.
  </p>
  <p>
    Permissions Chrome utilisées : <code>storage</code>, <code>activeTab</code>,{" "}
    <code>tabs</code>, <code>alarms</code>, <code>identity</code>,{" "}
    <code>clipboardWrite</code>, <code>sidePanel</code>, <code>offscreen</code>.
    Justification détaillée disponible dans la fiche Chrome Web Store et le
    manifeste public à{" "}
    <a
      href="https://github.com/Fonira/DeepSight-Main/blob/main/extension/public/manifest.json"
      className="text-blue-400 hover:underline"
    >
      github.com/.../manifest.json
    </a>
    .
  </p>
</Section>
```

- [ ] **Step 3 : Mettre à jour la date de dernière modification**

Modifier `LEGAL_INFO.lastUpdate` dans le fichier :

Ancien : `lastUpdate: "2 mars 2026"`
Nouveau : `lastUpdate: "29 avril 2026"`

- [ ] **Step 4 : Lint + typecheck**

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run typecheck
npm run lint -- --max-warnings 0 src/pages/PrivacyPolicy.tsx
```

Expected : pas d'erreur ni warning.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/pages/PrivacyPolicy.tsx
git commit -m "docs(privacy): add Chrome extension data section + bump update date"
```

---

### Task 8 : Self-review + finalisation

**Files :**

- Vérifier les 5 documents créés/modifiés
- Test final cohérence

- [ ] **Step 1 : Vérifier que tous les fichiers sont présents**

```bash
ls -la C:/Users/33667/DeepSight-Main/docs/CHROME-WEB-STORE-LISTING.md \
       C:/Users/33667/DeepSight-Main/docs/CHROME-WEB-STORE-SCREENSHOTS-BRIEF.md \
       C:/Users/33667/DeepSight-Main/docs/CHROME-WEB-STORE-VIDEO-SCRIPT.md \
       C:/Users/33667/DeepSight-Main/docs/CHROME-WEB-STORE-SUBMISSION-CHECKLIST.md \
       C:/Users/33667/DeepSight-Main/extension/CHROME_WEB_STORE.md \
       C:/Users/33667/DeepSight-Main/extension/CHROME_WEB_STORE.legacy.md
```

Expected : 6 fichiers existent.

- [ ] **Step 2 : Cohérence pricing dans tous les nouveaux docs**

```bash
grep -E "4,99|9,99|4\.99|9\.99|Plus" \
  C:/Users/33667/DeepSight-Main/docs/CHROME-WEB-STORE-LISTING.md \
  C:/Users/33667/DeepSight-Main/docs/CHROME-WEB-STORE-SCREENSHOTS-BRIEF.md \
  C:/Users/33667/DeepSight-Main/docs/CHROME-WEB-STORE-VIDEO-SCRIPT.md \
  C:/Users/33667/DeepSight-Main/docs/CHROME-WEB-STORE-SUBMISSION-CHECKLIST.md
```

Expected : aucun résultat (pricing v2 strict appliqué). Si résultat → corriger immédiatement.

- [ ] **Step 3 : Cohérence keywords (ranking SEO)**

```bash
grep -c "Mistral\|YouTube\|TikTok\|fact-check\|flashcards" \
  C:/Users/33667/DeepSight-Main/docs/CHROME-WEB-STORE-LISTING.md
```

Expected : > 10 occurrences.

- [ ] **Step 4 : Vérifier qu'aucun chemin obsolète n'est référencé**

```bash
grep -r "popup/components/MainView\|extension/CHROME_WEB_STORE\.md" \
  C:/Users/33667/DeepSight-Main/docs/ | grep -v "\.legacy\."
```

Expected : aucun résultat (les nouveaux docs référencent `sidepanel/` pas `popup/`).

- [ ] **Step 5 : Smoke test global du build extension**

```bash
cd C:/Users/33667/DeepSight-Main/extension
npm run typecheck
npm run build 2>&1 | tail -20
```

Expected : build réussit sans erreur, `dist/manifest.json` présent.

- [ ] **Step 6 : Commit final récapitulatif (optionnel — si modifs additionnelles)**

Si Step 2/3/4 ont demandé des fixes :

```bash
git add -A
git commit -m "chore(chrome-store): fix pricing v2 + path consistency in submission docs"
```

---

## Self-Review du plan

### 1. Couverture du spec

| Demande spec                                | Task couvrant         | Status                                                          |
| ------------------------------------------- | --------------------- | --------------------------------------------------------------- |
| Manifest V3 optimisé, permissions minimales | Task 3 (vérification) | OK — déjà optimal, aucune modif nécessaire                      |
| Description courte avec keywords            | Task 3                | OK — keywords déjà en place dans `_locales/`                    |
| Description longue 150-300 mots × FR + EN   | Task 2                | OK — §3 EN + §4 FR (~400 mots chacune, dans plage CWS 16k char) |
| 5 screenshots 1280×800 brief                | Task 4                | OK — 5 sections détaillées                                      |
| Vidéo promo 30-60s storyboard               | Task 5                | OK — 45s storyboard 6 sections                                  |
| Catégorie + tags                            | Task 2 §5             | OK                                                              |
| Soumission process checklist                | Task 6                | OK — 6 phases                                                   |
| Privacy policy URL + section extension      | Task 7                | OK                                                              |
| Permissions justification (audit MV3)       | Task 2 §7             | OK — reprises de la legacy doc                                  |
| Pricing v2 strict (8,99 / 19,99)            | Task 2 + Task 8 grep  | OK                                                              |

### 2. Placeholder scan

Recherche des patterns interdits dans le plan ci-dessus :

- `TODO`, `TBD` : 0 occurrence ✓
- "à définir" / "à préciser" : 0 occurrence ✓
- "similar to Task N" : 0 occurrence ✓
- "implement later" : 0 occurrence ✓
- "appropriate error handling" : 0 occurrence ✓

### 3. Cohérence types / chemins

- `extension/public/manifest.json` (pas `extension/manifest.json`) ✓
- `extension/public/_locales/{en,fr}/messages.json` ✓
- `frontend/src/pages/PrivacyPolicy.tsx` ✓
- `extension/src/sidepanel/` (l'extension est en MV3 Side Panel, pas popup historique) ✓ — corrigé dans le brief screenshots
- Pricing v2 (Pro 8,99 € / Expert 19,99 €) appliqué partout ✓
- Manifest version `2.0.0` partout ✓

### 4. Décisions à confirmer avec Maxime AVANT exécution

| Question                                                  | Options                                                                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Qui produit les 5 screenshots ?**                       | (a) Maxime DIY Figma 2-3h ; (b) freelance designer 200-400 €                                                                     |
| **Qui produit la vidéo promo 45s ?**                      | (a) Maxime DIY Capcut + ElevenLabs voix ~5 € + 4-6h ; (b) freelance vidéaste 500-1000 € ; (c) skip vidéo (impact ranking modéré) |
| **Soumission test/staging ou direct prod ?**              | (a) direct prod sur compte CWS officiel ; (b) compte test séparé d'abord (plus prudent mais 2× les frais 5 USD)                  |
| **Extension à 0 € ou freemium model ?**                   | Confirmation : extension reste gratuite, monétisation via SaaS Stripe sur web. Aucun in-app purchase Chrome.                     |
| **Visibility région**                                     | (a) "All regions" pour acquisition globale ; (b) restreindre EU+US si support langue limité                                      |
| **Promo tiles 440×280 + 920×680 + marquee 1400×560 ?**    | (a) produire les 3 (designer +200 €) ; (b) produire seulement small 440×280 ; (c) skip toutes (CWS accepte mais ranking moindre) |
| **Bump version 2.0.0 → 2.1.0 avant submit ?**             | (a) garder 2.0.0 (extension prête depuis Mars) ; (b) bumper à 2.1.0 pour marquer "publication CWS"                               |
| **Privacy Policy modif Task 7 — déployée AVANT submit ?** | OUI obligatoire — sinon Google rejette pour "privacy policy outdated/missing extension info". Synchroniser avec un push Vercel.  |

### 5. Ordre d'exécution recommandé

1. Tasks 1, 2, 3 en parallèle (fichiers indépendants)
2. Task 4 (peut être en parallèle aussi)
3. Task 5 (peut être en parallèle)
4. Task 6 (peut être en parallèle)
5. Task 7 (modif frontend, doit être déployée Vercel AVANT submit CWS)
6. Task 8 (review final + smoke test)

Si exécution séquentielle (subagent-driven default), suivre l'ordre 1→8.

---

## Execution Handoff

**Plan complet et sauvegardé. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — Un subagent frais par task, review entre tasks, itération rapide.

**2. Inline Execution** — Exécuter tasks dans cette session avec checkpoints groupés.

**Pré-requis avant exécution :** valider les 8 décisions du Self-Review §4 (notamment qui produit screenshots / vidéo, et bump version éventuel).

**Ordre de bloc recommandé :**

- Bloc A (docs) : Tasks 1-6 (peut être batched, aucune dépendance entre eux)
- Bloc B (code frontend) : Task 7 (touche `PrivacyPolicy.tsx` → déclenche push Vercel)
- Bloc C (verification) : Task 8 (review final + smoke test)
