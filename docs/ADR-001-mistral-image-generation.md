# ADR-001 : Migration du pipeline images vers Mistral Agents API

**Status :** Proposed  
**Date :** 11 avril 2026  
**Deciders :** Arinov (fondateur / solo dev)

---

## Context

Le pipeline "Le Saviez-Vous" génère des images IA pour illustrer des concepts/mots-clés dans DeepSight. Il fonctionne actuellement en 2 étapes séparées avec 3 services externes :

```
Terme + Définition
    │
    ▼
┌──────────────────────────────────────┐
│  Stage 1: Mistral Small 2503         │  ← API Call #1 (Mistral)
│  "Art Director" — génère une         │
│  métaphore visuelle créative (JSON)  │
│  temp=0.9, max_tokens=500            │
└──────────────┬───────────────────────┘
               │ visual_prompt (anglais)
               ▼
┌──────────────────────────────────────┐
│  Stage 2: Image Generation           │  ← API Call #2 (Together AI ou OpenAI)
│  Free → FLUX.1 Schnell (Together)    │
│  Premium → DALL-E 3 (OpenAI)         │
└──────────────┬───────────────────────┘
               │ raw bytes (1024x1024)
               ▼
┌──────────────────────────────────────┐
│  Post-process: PIL → 512x512 WebP   │
│  Upload R2 → INSERT keyword_images   │
└──────────────────────────────────────┘
```

### Problèmes identifiés

1. **Bug critique** : `get_together_key()` appelé dans `keyword_images.py` (ligne 21) mais **jamais défini** dans `core/config.py` → `NameError` au runtime. Le pipeline free est cassé.

2. **3 dépendances API** : Mistral + Together AI + OpenAI. Chaque dépendance = un point de failure + une API key à gérer + un vendor à monitorer.

3. **Qualité limitée** : FLUX.1 Schnell (free) produit des images correctes mais parfois floues, peu détaillées. C'est le modèle le plus basique de la famille FLUX.

4. **Incohérence branding** : DeepSight se positionne "100% Mistral AI" mais utilise Together AI + OpenAI pour l'image gen.

5. **Overhead pipeline** : 2 appels API séquentiels (Mistral pour le prompt, puis Together/OpenAI pour l'image) = latence cumulée + double risque d'échec.

### Opportunité

Mistral a lancé l'**image generation comme outil built-in** dans son Agents API (beta). L'outil est propulsé par **FLUX 1.1 Pro Ultra** (Black Forest Labs) — un modèle premium bien supérieur à FLUX Schnell.

L'Agents API permet de créer un agent avec des instructions custom + l'outil `image_generation`. L'agent peut raisonner sur le meilleur visuel ET le générer en un seul appel.

---

## Decision

**Ajouter un 3ème backend d'image gen** (`_stage2_mistral_agent()`) dans le pipeline existant, en utilisant l'Agents API Mistral avec l'outil `image_generation` built-in. Ce backend deviendra le **défaut pour tous les utilisateurs**, remplaçant progressivement Together AI (free) et réduisant la dépendance à OpenAI (premium).

### Architecture cible

```
Terme + Définition
    │
    ▼
┌──────────────────────────────────────────────┐
│  Mistral Agent "DeepSight Art Director"       │  ← 1 seul appel API
│  Model: mistral-medium-latest                 │
│  Tools: [image_generation]                    │
│  Instructions: Style DeepSight + métaphore    │
│                                               │
│  L'agent :                                    │
│  1. Raisonne sur le concept (art direction)   │
│  2. Invoque image_generation (FLUX Pro Ultra) │
│  3. Retourne le file_id de l'image            │
└──────────────────────────┬───────────────────┘
                           │ file_id → download PNG
                           ▼
┌──────────────────────────────────────────────┐
│  Post-process: PIL → 512x512 WebP            │
│  Upload R2 → INSERT keyword_images           │
└──────────────────────────────────────────────┘
```

---

## Options Considered

### Option A : Mistral Agent API (image_generation built-in)

| Dimension | Assessment |
|-----------|------------|
| Complexité | **Basse** — 1 agent à créer, 1 conversation à démarrer, 1 fichier à télécharger |
| Coût | **À valider** — potentiellement inclus dans le tier Scale/API, pricing non documenté par image |
| Qualité | **Haute** — FLUX 1.1 Pro Ultra (vs Schnell actuellement) |
| Cohérence stack | **Parfaite** — tout Mistral, 1 seule API key |
| Latence | **Moyenne** — 1 appel agent (inclut raisonnement + génération), probablement 10-20s |
| Contrôle prompt | **Indirect** — on donne des instructions à l'agent, pas un prompt direct à FLUX |

**Pros :**
- Pipeline unifié : 1 API call au lieu de 2
- Qualité image supérieure (FLUX Pro Ultra >> Schnell)
- Supprime la dépendance Together AI
- Cohérent avec le branding "100% Mistral"
- L'agent raisonne sur la métaphore ET génère — plus intelligent que Stage1 → Stage2 séparé
- Fallback naturel : si l'agent échoue, on garde DALL-E 3

**Cons :**
- API en **beta** — risque de breaking changes
- Pricing pas clairement documenté par image via API
- Moins de contrôle sur le prompt exact envoyé à FLUX (l'agent reformule)
- File download supplémentaire (file_id → GET /files/{id}/content)
- Pas de contrôle sur la résolution (l'outil retourne PNG, pas de paramètre size)
- Nécessite `mistralai` SDK avec support `.beta.agents` (vérifier version)

### Option B : FLUX Pro/Dev via API directe (Black Forest Labs ou FAL.ai)

| Dimension | Assessment |
|-----------|------------|
| Complexité | **Moyenne** — nouvel appel API direct, similaire à Together AI |
| Coût | **~0.04-0.06€/image** pour FLUX Pro, ~0.01€ pour FLUX Dev |
| Qualité | **Haute** — FLUX 1.1 Pro (très bon), FLUX 2 Pro (état de l'art) |
| Cohérence stack | **Moyenne** — garde Mistral pour art direction + nouveau vendor pour l'image |
| Latence | **Basse à moyenne** — 5-15s selon le modèle |
| Contrôle prompt | **Total** — on envoie le prompt exact |

**Pros :**
- Contrôle total sur le prompt, la résolution, les steps
- API stable et mature (pas beta)
- Pricing transparent
- `FAL_API_KEY` déjà défini dans `config.py` (mais inutilisé)
- Résolution configurable (512, 1024, custom)

**Cons :**
- Ajoute un vendor (FAL.ai ou BFL direct) au lieu d'en retirer un
- Pipeline toujours en 2 étapes (Stage1 Mistral + Stage2 FLUX)
- Pas de gain architectural, juste un upgrade de modèle image

### Option C : Garder le pipeline actuel et juste fixer le bug

| Dimension | Assessment |
|-----------|------------|
| Complexité | **Minimale** — ajouter `get_together_key()` dans config.py |
| Coût | **Inchangé** — ~0.003€/image (free), ~0.04€ (premium) |
| Qualité | **Inchangée** — FLUX Schnell reste basique |
| Cohérence stack | **Mauvaise** — 3 vendors |
| Latence | **Inchangée** |
| Contrôle prompt | **Total** |

**Pros :**
- Zéro risque, zéro effort
- On sait que ça fonctionne (quand le bug est fixé)

**Cons :**
- Ne résout aucun des problèmes structurels (3 vendors, qualité Schnell, branding)
- La dette technique reste

---

## Trade-off Analysis

Le choix principal est entre **Option A** (Mistral Agent) et **Option B** (FLUX direct via FAL/BFL).

| Critère | Option A (Agent) | Option B (FLUX direct) |
|---------|-----------------|----------------------|
| Simplification | ✅ Supprime 1 vendor | ❌ Ajoute/remplace 1 vendor |
| Qualité image | ✅ FLUX Pro Ultra | ✅ FLUX Pro/Dev |
| Contrôle prompt | ⚠️ Indirect (via instructions agent) | ✅ Direct (prompt → image) |
| Stabilité API | ⚠️ Beta | ✅ Stable |
| Cohérence "100% Mistral" | ✅ Parfaite | ❌ Non |
| Pricing clarity | ⚠️ Non documenté | ✅ Transparent |
| Effort d'implémentation | ~2h | ~1h |

**Ma recommandation : Option A (Mistral Agent) comme défaut, avec fallback sur Option B (FAL.ai FLUX Pro) si les limites de l'Agent API se révèlent bloquantes.**

Raison : la simplification architecturale + la cohérence branding + la qualité d'image valent le risque beta. Et on garde toujours DALL-E 3 en dernier fallback.

---

## Implementation Plan

### Phase 0 — Fix immédiat (30 min)
- [ ] Ajouter `get_together_key()` dans `core/config.py` (fix le bug actuel)
- [ ] Vérifier la version du SDK `mistralai` dans `requirements.txt` (besoin de `.beta.agents`)

### Phase 1 — POC Mistral Agent (2-3h)
- [ ] Créer l'agent "DeepSight Art Director" via l'API (une seule fois, stocker l'`agent_id`)
- [ ] Implémenter `_stage2_mistral_agent()` dans `keyword_images.py`
- [ ] Ajouter le download du fichier généré (file_id → bytes)
- [ ] Tester sur 10 termes variés (cognitif, science, philo, tech, culture)
- [ ] Comparer qualité vs FLUX Schnell actuel et DALL-E 3

### Phase 2 — Intégration (1-2h)
- [ ] Ajouter la config `MISTRAL_IMAGE_AGENT_ID` dans `core/config.py` et `.env.production`
- [ ] Modifier `_stage2_generate_image()` :
  ```python
  async def _stage2_generate_image(visual_prompt, premium=False):
      # Priority 1: Mistral Agent (all users)
      if get_mistral_agent_id():
          return await _stage2_mistral_agent(visual_prompt)
      # Priority 2: DALL-E 3 (premium fallback)
      if premium and get_openai_key():
          return await _stage2_dalle3(visual_prompt)
      # Priority 3: FLUX Schnell (free fallback)
      if get_together_key():
          return await _stage2_flux_schnell(visual_prompt)
      # Priority 4: DALL-E 3 (any user, last resort)
      if get_openai_key():
          return await _stage2_dalle3(visual_prompt)
      raise RuntimeError("No image backend available")
  ```
- [ ] Mettre à jour le model enregistré dans `keyword_images` (colonne `model`)

### Phase 3 — Optimisation Agent (optionnel, après validation qualité)
- [ ] Fusionner Stage 1 + Stage 2 : supprimer `_stage1_art_director()` séparé, laisser l'agent faire les deux
- [ ] Enrichir les instructions agent avec des exemples de style DeepSight
- [ ] Ajouter un champ `metaphor_reasoning` dans la réponse agent pour le logging

### Phase 4 — Cleanup
- [ ] Si Mistral Agent confirmé stable : retirer la dépendance Together AI
- [ ] Mettre à jour la doc (`CLAUDE.md`, `docs/`)
- [ ] Monitorer les coûts sur 1 semaine

---

## Consequences

### Ce qui devient plus facile
- Maintenance : 1 seule API key pour tout le pipeline d'images
- Branding : communication "100% Mistral AI" sans astérisque
- Onboarding : un nouveau dev n'a qu'une API à comprendre
- Qualité : images nettement meilleures grâce à FLUX Pro Ultra

### Ce qui devient plus difficile
- Debug : si l'agent hallucine ou génère un style incohérent, on a moins de contrôle qu'un prompt direct
- Migration retour : si Mistral change/deprecate l'Agents API beta, il faudra revenir sur Together/FAL

### Ce qu'il faudra revisiter
- Pricing : surveiller la facturation Mistral côté images (premier mois)
- Résolution : l'Agent API ne semble pas offrir de contrôle sur la taille — valider que le PNG retourné est assez grand pour le resize 512x512
- Rate limits : vérifier les limites agents/conversations par minute sur le tier Scale Mistral
- SDK version : s'assurer que `mistralai` Python supporte `client.beta.agents` (probablement >=1.x)

---

## Technical Appendix: Code Skeleton

```python
# ─── Stage 2c: Mistral Agent (FLUX Pro Ultra via Agents API) ──────────────

# Agent ID stored in config (created once via API)
MISTRAL_IMAGE_AGENT_ID: Optional[str] = None

async def _stage2_mistral_agent(visual_prompt: str) -> tuple[bytes, str]:
    """Generate image via Mistral Agent with built-in image_generation tool.
    Returns (raw_bytes, model_used)."""
    try:
        from mistralai import Mistral
    except ImportError:
        from mistralai.client import Mistral

    client = Mistral(api_key=get_mistral_key())
    agent_id = get_mistral_image_agent_id()

    if not agent_id:
        raise RuntimeError("MISTRAL_IMAGE_AGENT_ID not configured")

    # Full prompt with DeepSight style
    full_prompt = (
        f"Generate an image for this concept: {visual_prompt}. "
        f"Style: {DEEPSIGHT_STYLE_SUFFIX}"
    )

    # Start conversation with the agent
    response = client.beta.conversations.start(
        agent_id=agent_id,
        inputs=full_prompt,
    )

    # Extract the generated image file_id from response
    file_id = None
    for entry in response.outputs:
        if hasattr(entry, 'content'):
            for chunk in entry.content:
                if hasattr(chunk, 'file_id'):
                    file_id = chunk.file_id
                    break
        if file_id:
            break

    if not file_id:
        raise RuntimeError("Mistral Agent did not return an image file")

    # Download the generated image
    file_bytes = client.files.download(file_id=file_id).read()

    logger.info(f"🖼️ Image generated (Mistral Agent/FLUX Pro Ultra): {len(file_bytes)} bytes")
    return file_bytes, "mistral-agent-flux-pro-ultra"
```

### Agent Creation Script (one-time)

```python
"""Run once to create the DeepSight image agent. Store the returned agent_id in .env.production."""

from mistralai import Mistral
import os

client = Mistral(api_key=os.environ["MISTRAL_API_KEY"])

agent = client.beta.agents.create(
    model="mistral-medium-latest",
    name="DeepSight Art Director",
    description="Generates editorial still-life images for educational concepts.",
    instructions=(
        "You are the art director for DeepSight, an AI-powered video analysis platform. "
        "When given a concept or keyword, generate a visually striking editorial still-life image. "
        "\n\n"
        "MANDATORY STYLE:\n"
        "- Pure black background (#0a0a0f)\n"
        "- Single warm gold rim light from the left (#C8903A)\n"
        "- Sharp focus, shallow depth of field\n"
        "- Clean minimal composition with 1-2 objects maximum\n"
        "- No text, no people, no watermarks\n"
        "- Style: editorial, premium, conceptual\n"
        "\n"
        "CREATIVE APPROACH:\n"
        "- Never illustrate the concept literally\n"
        "- Find an indirect visual metaphor — an everyday object that EMBODIES the concept\n"
        "- The viewer should think 'ah!' after reading the definition\n"
        "- Think Magritte meets intellectual meme culture\n"
        "\n"
        "Always generate the image using the image generation tool."
    ),
    tools=[{"type": "image_generation"}],
    completion_args={
        "temperature": 0.7,
        "top_p": 0.95,
    },
)

print(f"Agent created! ID: {agent.id}")
print(f"Add to .env.production: MISTRAL_IMAGE_AGENT_ID={agent.id}")
```

---

*ADR-001 — DeepSight — Avril 2026*
