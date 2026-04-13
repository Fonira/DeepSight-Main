---
description: "Prompts Mistral AI et pipeline d'analyse DeepSight. TOUJOURS consulter cette skill avant de modifier un prompt d'analyse, changer un mode, ajuster les paramètres Mistral, ou créer un nouveau type d'analyse."
---

# Prompts Mistral DeepSight — Pipeline d'analyse

## Architecture du pipeline

YouTube URL → Extraction transcript → Chunking (si > 8000 tokens) → Mistral Analysis (mode + feature)

## Paramètres Mistral

```python
MISTRAL_CONFIG = {
    "model": "mistral-large-latest",
    "temperature": 0.3,
    "max_tokens": 4096,
    "top_p": 0.9,
}

FEATURE_CONFIG = {
    "synthesis":  {"temperature": 0.3, "max_tokens": 4096},
    "flashcards": {"temperature": 0.2, "max_tokens": 2048},
    "quiz":       {"temperature": 0.4, "max_tokens": 2048},
    "mindmap":    {"temperature": 0.2, "max_tokens": 2048},
    "factcheck":  {"temperature": 0.1, "max_tokens": 1024},
    "compare":    {"temperature": 0.3, "max_tokens": 6144},
}
```

## System prompt universel

```
Tu es DeepSight, un assistant spécialisé dans l'analyse approfondie de contenu vidéo YouTube.
Règles : baser chaque affirmation UNIQUEMENT sur le transcript, ne jamais inventer, répondre en {language}.
```

## Modes d'analyse

### ACCESSIBLE (Découverte) : En une phrase + 3-5 points clés + 1 insight pratique

### STANDARD (Étudiant+) : Résumé exécutif + idées principales + arguments + limites + applications

### EXPERT (Starter+) : Thèse centrale + structure argumentative + analyse des preuves + biais + évaluation critique

## Features Studio

### Flashcards : JSON `{"flashcards": [{"question", "answer", "category"}]}` (8-15 cards, temp 0.2)

### Quiz : JSON `{"quiz": [{"question", "options", "correct", "explanation", "difficulty"}]}` (5-10 questions)

### Mindmap : JSON `{"title", "branches": [{"label", "children"}]}` (max 4 branches, 3 niveaux)

### Factcheck : Extraction claims → Vérification Perplexity → Synthèse `{"score": 0-100, "results": [{"verdict": "vérifié|réfuté|nuancé"}]}`

### Compare : Convergences + divergences + tableau comparatif + recommandation

## Chunking — Transcripts longs

```python
MAX_TOKENS_PER_CHUNK = 6000
OVERLAP_TOKENS = 200

# Multi-chunk : synthèses partielles puis méta-synthèse
async def analyze_long_video(transcript, mode):
    chunks = chunk_transcript(transcript)
    if len(chunks) == 1:
        return await analyze_single(chunks[0], mode)
    partial_syntheses = [await analyze_single(chunk, mode) for chunk in chunks]
    return await call_mistral(meta_prompt, max_tokens=6144)
```

## Gestion d'erreurs

```python
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def call_mistral(prompt, feature="synthesis"):
    # Retry automatique sur rate_limit
```

## Anti-patterns

- temperature 0.9 pour flashcards → utiliser 0.2
- JSON sans préciser format strict → toujours "JSON strict, aucun texte autour"
- Parser response.text directement → json.loads() avec try/catch
- Un seul prompt pour toutes features → prompts dédiés
- Ignorer longueur transcript → toujours chunker si > 6000 tokens
