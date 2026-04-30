# Chrome Web Store Listing — DeepSight

## Nom

DeepSight - AI Video Analysis

## Description courte (132 caracteres max)

Analyze YouTube & TikTok videos with AI. Fact-checked summaries, contextual chat, flashcards. Powered by Mistral AI.

## Description longue (EN)

DeepSight transforms YouTube and TikTok videos into structured, fact-checked analyses — directly from your browser.

Unlike simple summarizers, DeepSight goes deeper: every key claim is verified against reliable sources, and you get a full analysis with timestamps, not just bullet points.

KEY FEATURES:

- AI-Powered Analysis: Paste a video URL, get a structured analysis with key insights, timestamps and critical evaluation in seconds
- Contextual Chat: Ask follow-up questions about any analyzed video — the AI responds with full context
- Fact-Checking: Claims are automatically verified against web sources (Pro plan)
- Quick Chat: Chat about any YouTube video without using credits — completely free
- 3 Analysis Modes: Accessible, Standard, Expert — adapts to your level
- TikTok Support: Analyze TikTok videos too, not just YouTube

STUDY TOOLS (on the web app):

- Auto-generated flashcards with FSRS spaced repetition (same algorithm as Anki)
- Interactive quizzes from video content
- Mind maps showing concept relationships (Pro)
- Academic paper search from arXiv, Semantic Scholar, CrossRef, OpenAlex

WHAT MAKES DEEPSIGHT DIFFERENT:

1. Not a summarizer — a research platform. We verify, not just summarize.
2. European AI (Mistral) — your data stays in Europe. GDPR compliant.
3. AI Debate — compare arguments from 2 videos on the same topic (unique feature)
4. Academic enrichment — link video content to scientific papers
5. Tri-platform — web + mobile + extension, one account

FREE TO START:

- 3 free analyses without an account
- 5 analyses/month with a free account
- No credit card required

PLANS:

- Free: 5 analyses/month, chat, flashcards
- Pro (8.99 EUR/month): 30 analyses, 2h videos, fact-checking, mind maps, web search, PDF export, playlists
- Expert (19.99 EUR/month): 100 analyses, 4h videos, voice chat 30min/month (ElevenLabs), Mistral Large, deep research, priority queue

Built by an independent European developer. Made in France.

Website: https://www.deepsightsynthesis.com

## Description longue (FR)

DeepSight transforme les videos YouTube et TikTok en analyses structurees et fact-checkees — directement depuis votre navigateur.

Contrairement aux simples resumeurs, DeepSight va plus loin : chaque affirmation cle est verifiee avec des sources fiables, et vous obtenez une analyse complete avec timestamps, pas juste des bullet points.

FONCTIONNALITES CLES :

- Analyse IA : Collez un lien video, obtenez une analyse structuree avec points cles, timestamps et evaluation critique en quelques secondes
- Chat contextuel : Posez des questions sur n'importe quelle video analysee — l'IA repond avec le contexte complet
- Fact-checking : Les affirmations sont automatiquement verifiees avec des sources web (plan Pro)
- Quick Chat : Discutez de n'importe quelle video YouTube sans utiliser de credits — entierement gratuit
- 3 modes d'analyse : Accessible, Standard, Expert — s'adapte a votre niveau
- Support TikTok : Analysez aussi les videos TikTok, pas seulement YouTube

OUTILS D'ETUDE (sur l'app web) :

- Flashcards automatiques avec repetition espacee FSRS (meme algorithme qu'Anki)
- Quiz interactifs generes depuis le contenu video
- Cartes mentales montrant les relations entre concepts (Pro)
- Recherche de papiers academiques depuis arXiv, Semantic Scholar, CrossRef, OpenAlex

CE QUI REND DEEPSIGHT DIFFERENT :

1. Pas un resumeur — une plateforme de recherche. On verifie, on ne resume pas seulement.
2. IA europeenne (Mistral) — vos donnees restent en Europe. Conforme RGPD.
3. Debat IA — confrontez les arguments de 2 videos sur le meme sujet (fonctionnalite unique)
4. Enrichissement academique — reliez le contenu video a des papiers scientifiques
5. Tri-plateforme — web + mobile + extension, un seul compte

GRATUIT POUR COMMENCER :

- 3 analyses gratuites sans compte
- 5 analyses/mois avec un compte gratuit
- Pas de carte bancaire requise

PLANS :

- Gratuit : 5 analyses/mois, chat, flashcards
- Pro (8,99 EUR/mois) : 30 analyses, videos 2h, fact-checking, cartes mentales, web search, export PDF, playlists
- Expert (19,99 EUR/mois) : 100 analyses, videos 4h, chat vocal 30 min/mois (ElevenLabs), Mistral Large, recherche approfondie, file prioritaire

Developpe par un developpeur independant europeen. Made in France.

Site web : https://www.deepsightsynthesis.com

## Categorie

Productivity

## Langue

Francais, English

## Mots-cles (tags)

youtube summary, video analysis, AI, fact-check, flashcards, TikTok, Mistral AI, study tool, transcript, European AI

## Politique de confidentialite

https://www.deepsightsynthesis.com/privacy

## Screenshots a preparer

1. Sidebar d'analyse sur YouTube (synthese structuree)
2. Chat contextuel en action (question + reponse)
3. Quick Chat (0 credits, chat rapide)
4. Popup avec analyse en cours (progression)
5. Analyse TikTok (sidebar sur TikTok)

## Permissions justifications (Chrome Web Store form)

These justifications are pasted as-is into the CWS submission form, one per
permission. Keep them short, factual, and tied to a user-facing feature.

### Standard permissions

- **storage** — Persist authentication tokens (access + refresh), user
  preferences (UI language, voice settings), and a small cache of recent
  analyses for offline access. No tracking, no third-party sharing.

- **activeTab** — Read the URL of the YouTube or TikTok video currently
  active in the user's tab so the user can trigger an AI analysis with one
  click. Only the video ID is sent to our backend; no DOM scraping is
  performed.

- **tabs** — Detect URL changes (e.g. user navigates to a new YouTube
  video) to refresh the Side Panel context (video detected card, analysis
  state). Used solely on YouTube and TikTok.

- **alarms** — Periodic background refresh of the OAuth access token
  (15-minute lifespan) using the refresh token, so the user does not need
  to re-login every 15 minutes.

- **identity** — Used by chrome.identity.launchWebAuthFlow() to perform
  Google OAuth login. The flow opens the standard Google consent screen
  in a popup and returns an OAuth code we exchange server-side for a JWT.

- **clipboardWrite** — Allow the user to copy generated content
  (summaries, fact-check results, flashcards) to the system clipboard with
  one click, from the Side Panel "Copy" buttons.

- **sidePanel** — Display the DeepSight interface in Chrome's native Side
  Panel (Chrome 114+), persistent across tab switches. Toggle via
  Alt+Shift+D or the toolbar icon.

- **offscreen** — Required by the ElevenLabs voice SDK on Chrome MV3 to
  host an offscreen document for audio capture and playback (service
  workers cannot access getUserMedia directly).

### Optional permissions

- **audioCapture** (optional, requested only when the user starts a voice
  chat session) — Capture microphone input for the ElevenLabs ConvAI
  voice agent. Audio is streamed directly to ElevenLabs over a secure
  WebSocket; no audio is persisted on our servers.

### Host permissions

- **https://www.youtube.com/_, https://youtube.com/_** — Detect the
  currently watched video and inject the optional content-script overlay
  showing the analyze button. No analytics, no DOM modification beyond
  the overlay.

- **https://www.tiktok.com/_, https://tiktok.com/_, https://vm.tiktok.com/_,
  https://m.tiktok.com/_** — Same as YouTube, for TikTok video detection.

- **https://www.deepsightsynthesis.com/*** — Cross-domain authentication
  sync between the extension and the web app, so a user logged in on the
  web is automatically logged in on the extension (and vice versa).

- **https://api.deepsightsynthesis.com/*** — Backend API endpoints for
  analyses, chat, billing, voice sessions, etc.

- **https://api.elevenlabs.io/_, wss://api.elevenlabs.io/_,
  https://_.elevenlabs.io/_, wss://_.elevenlabs.io/\_** — ElevenLabs
  ConvAI voice chat over WebSocket. Required by the @elevenlabs/client
  SDK; CSP whitelist already restricts connect-src to these domains.

## Single purpose statement (Chrome Web Store form)

DeepSight is an AI-powered analysis tool for YouTube and TikTok videos.
Its single purpose is to help users understand, fact-check, and study
video content via AI-generated summaries, contextual chat, flashcards,
and an optional voice agent — all from a persistent Side Panel inside
Chrome.
