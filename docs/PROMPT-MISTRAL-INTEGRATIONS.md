# Mega-Prompt — Intégrations Mistral AI avancées pour DeepSight

> Coller ce prompt au début d'une nouvelle session Claude Code / Cowork pour lancer le chantier.

---

## Contexte

Je suis le fondateur solo de **DeepSight**, un SaaS d'analyse IA de vidéos YouTube/TikTok. Le projet est un monorepo tri-plateforme (Web React + Mobile Expo + Extension Chrome) avec un backend FastAPI Python déployé sur Hetzner VPS Docker.

**Ce qui vient d'être fait (avril 2026) :**
- Migration du tier Mistral Experiment → Scale (6 req/s, 2M tokens/min)
- Création de `core/llm_provider.py` — helper centralisé avec fallback chain (Mistral → DeepSeek)
- Tous les appels LLM passent par `llm_complete()` et `llm_complete_stream()`
- DeepSeek configuré comme fallback de résilience

**Stack actuelle pertinente :**
- Backend : FastAPI + Python 3.11 + httpx (async)
- AI : Mistral API (Small 2603, Medium 2508, Large 2512) via `core/llm_provider.py`
- Fact-check : Brave Search API + Mistral synthèse (`videos/web_search_provider.py`)
- Transcription STT fallback : Groq Whisper → OpenAI Whisper → Deepgram Nova-2 → AssemblyAI (`transcripts/youtube.py`)
- TTS : ElevenLabs (prévu mais pas encore branché côté backend)
- AudioSummaryPlayer : composant frontend EXISTANT, attend un endpoint backend TTS

**Fichiers clés à lire avant de coder :**
- `backend/src/core/llm_provider.py` — Le helper LLM centralisé
- `backend/src/core/config.py` — Toutes les config/API keys
- `backend/src/videos/web_search_provider.py` — Pipeline Brave + Mistral
- `backend/src/videos/analysis.py` — Génération d'analyses (generate_summary)
- `backend/src/transcripts/youtube.py` — Pipeline transcription 7 méthodes
- `backend/src/videos/service.py` — Chat sync + streaming
- `CLAUDE.md` — Architecture complète du projet

---

## Tâches à implémenter (dans cet ordre)

### TÂCHE 1 : Agents API Mistral — Remplacer le pipeline Brave + Mistral

**Objectif :** Remplacer le pipeline actuel (Brave Search → synthèse Mistral séparée) par un **Agent Mistral avec web search natif intégré**. Un seul appel API au lieu de 2-3.

**Ce qui existe :**
- `videos/web_search_provider.py` : appelle Brave Search, puis passe les résultats à Mistral pour synthèse
- Utilisé pour : enrichissement d'analyse, fact-check, chat enrichi, débat IA

**Ce qu'il faut faire :**
1. Créer un Agent Mistral via l'API Agents (POST https://api.mistral.ai/v1/agents)
   - Nom : "DeepSight Analyst"
   - Instructions : prompt système pour fact-checking et enrichissement
   - Tools : `web_search` (built-in Mistral)
   - Modèle : mistral-small-2603 (ou configurable)
2. Créer `core/mistral_agent.py` — wrapper pour appeler l'Agent
3. Modifier `web_search_provider.py` pour utiliser l'Agent au lieu du pipeline Brave+Mistral
4. Garder Brave Search en fallback si l'Agent échoue
5. Ajouter les métriques (tokens, sources, latence) dans les logs

**Documentation Mistral :** https://docs.mistral.ai/agents/introduction + https://docs.mistral.ai/agents/tools/built-in

**⚠️ Vérifier :** est-ce que l'Agent API supporte le streaming SSE ? Si oui, l'utiliser pour le chat enrichi.

---

### TÂCHE 2 : Batch API — Analyses playlist et corpus à -50%

**Objectif :** Toutes les analyses non-temps-réel passent par le Batch API Mistral (50% moins cher, asynchrone).

**Ce qui existe :**
- `backend/src/playlists/` : analyse de playlists (itère sur chaque vidéo → analyse séquentielle)
- `backend/src/batch/` : batch analyses existantes
- Les playlists peuvent avoir 10-50 vidéos → beaucoup de tokens

**Ce qu'il faut faire :**
1. Créer `core/mistral_batch.py` — wrapper pour le Batch API
   - Soumettre un batch de requêtes chat/completions en JSONL
   - Poller le status jusqu'à completion
   - Parser les résultats
2. Ajouter `llm_complete_batch()` dans `core/llm_provider.py`
3. Modifier le pipeline playlist pour utiliser le batch (toutes les vidéos en un seul batch)
4. Ajouter un mode "background analysis" qui utilise le batch pour les analyses planifiées
5. Logging : tokens économisés, temps de traitement batch vs sync

**Documentation :** https://docs.mistral.ai/capabilities/batch/

---

### TÂCHE 3 : Voxtral TTS — Audio Summaries

**Objectif :** Générer des synthèses audio à partir des analyses texte. Le composant frontend AudioSummaryPlayer existe déjà.

**Ce qui existe :**
- Frontend : `AudioSummaryPlayer` component (attend un endpoint backend)
- Config : `TTS_PROVIDER` dans config.py, `ELEVENLABS_API_KEY` configuré
- Pas encore d'endpoint backend `/api/tts/` ou `/api/audio/`

**Ce qu'il faut faire :**
1. Créer `backend/src/audio/router.py` — endpoints TTS
   - POST `/api/audio/tts` — génère audio à partir de texte (synthèse)
   - GET `/api/audio/tts/{summary_id}` — récupère l'audio d'une analyse
   - Streaming audio SSE si possible
2. Créer `backend/src/audio/tts_provider.py` — wrapper Voxtral TTS
   - Endpoint Mistral : POST https://api.mistral.ai/v1/audio/speech (vérifier la doc exacte)
   - Voix par défaut : voix française naturelle (choisir parmi les 20 presets)
   - Fallback vers ElevenLabs si Voxtral échoue
3. Ajouter le router dans `main.py`
4. Cacher l'audio généré (Redis ou filesystem) — pas régénérer à chaque lecture
5. Gating par plan : TTS = feature Pro minimum

**Documentation :** https://docs.mistral.ai/capabilities/audio/text_to_speech

**⚠️ Note :** Voxtral TTS supporte le zero-shot voice cloning. On pourrait créer une "voix DeepSight" brandée à partir de 2-3 secondes d'audio. Feature V2.

---

### TÂCHE 4 : Voxtral STT — Unifier les fallbacks transcription

**Objectif :** Remplacer les 4 providers STT de la Phase 3 (Groq Whisper → OpenAI Whisper → Deepgram → AssemblyAI) par Voxtral Transcribe V2.

**Ce qui existe :**
- `transcripts/youtube.py` : pipeline 7 méthodes
  - Phase 0 : Supadata (prioritaire, texte)
  - Phase 1 : youtube-transcript-api + Invidious + Piped (texte)
  - Phase 2 : yt-dlp (sous-titres)
  - Phase 3 : Audio STT → 4 providers en fallback chain
- Phase 3 télécharge l'audio puis transcrit via Groq → OpenAI → Deepgram → AssemblyAI

**Ce qu'il faut faire :**
1. Créer `backend/src/audio/stt_provider.py` — wrapper Voxtral STT
   - Endpoint : POST https://api.mistral.ai/v1/audio/transcriptions (vérifier la doc)
   - Mode batch pour les fichiers longs
   - Timestamps word-level + speaker diarization si dispo
2. Modifier Phase 3 dans `transcripts/youtube.py` :
   - Voxtral STT en premier (remplace Groq+OpenAI+Deepgram)
   - Garder AssemblyAI en dernier fallback si on veut un backup non-Mistral
3. Simplifier les dépendances : supprimer les config/keys Groq, Deepgram si plus utilisées
4. Logging : WER estimé, langues détectées, timestamps

**Documentation :** https://docs.mistral.ai/capabilities/audio/speech_to_text

---

### TÂCHE 5 : Fine-tuning — Modèle DeepSight custom

**Objectif :** Fine-tuner mistral-small sur les analyses existantes pour obtenir des analyses parfaitement formatées à 1/10ème du prix de Large.

**Ce qu'il faut faire :**
1. Créer `scripts/export_training_data.py` :
   - Requêter la DB PostgreSQL pour récupérer les meilleures analyses (>500 mots, bien formatées)
   - Exporter en format JSONL pour fine-tuning Mistral :
     ```jsonl
     {"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "Titre: X\nTranscript: Y\n..."}, {"role": "assistant", "content": "analyse complète ici"}]}
     ```
   - Filtrer : garder les analyses en mode standard + expert, plan Pro+
   - Objectif : 200-500 exemples de qualité
2. Créer `scripts/finetune_mistral.py` :
   - Upload du JSONL via Files API
   - Lancer le fine-tuning via API
   - Monitorer le training
3. Après fine-tuning :
   - Ajouter le modèle custom dans `MISTRAL_MODELS` de config.py
   - A/B test : 50% analyses avec le modèle custom, 50% avec le modèle standard
   - Comparer qualité (longueur, structure, pertinence) et coût

**Documentation :** https://docs.mistral.ai/capabilities/finetuning/

**⚠️ Important :** Ne pas fine-tuner avant d'avoir au moins 200 exemples de haute qualité. Qualité > Quantité.

---

### TÂCHE 6 : Document AI / OCR — Analyser des PDFs

**Objectif :** Nouvelle feature : "Upload un PDF → DeepSight l'analyse comme une vidéo".

**Ce qu'il faut faire :**
1. Créer `backend/src/documents/router.py` :
   - POST `/api/documents/analyze` — upload PDF + lance analyse
   - GET `/api/documents/status/{task_id}` — poll status
   - GET `/api/documents/{doc_id}` — résultat complet
2. Créer `backend/src/documents/ocr_provider.py` :
   - Utiliser Mistral OCR : POST https://api.mistral.ai/v1/ocr
   - Extraire le texte Markdown structuré
   - Gérer les PDFs multi-pages (2000 pages/min)
3. Réutiliser le pipeline d'analyse existant :
   - Le texte OCR remplace le "transcript" dans generate_summary()
   - Même pipeline : analyse → flashcards → quiz → mind map
4. Gating : feature Pro minimum
5. Limites : max 50 pages en Free, 200 pages en Pro

**Documentation :** https://docs.mistral.ai/capabilities/document_ai/

**Cible users :** étudiants, chercheurs, professionnels qui veulent analyser des cours/rapports PDF.

---

## Règles générales

- **UNE tâche à la fois**, dans l'ordre numéroté
- **Toujours lire les fichiers existants** avant de modifier
- **Fallback chain** : toute nouvelle intégration Mistral doit avoir un fallback
- **Tests** : écrire des tests unitaires pour chaque nouveau module
- **Logs structurés** : utiliser le logger existant, pas print()
- **Pas de secrets hardcodés** : tout via config.py/.env.production
- **Compatibilité** : le llm_provider.py existant doit rester fonctionnel
- Lire la **documentation Mistral à jour** avant chaque tâche (les API changent vite)
- Commencer par la tâche 1 et me demander validation avant de passer à la suivante
