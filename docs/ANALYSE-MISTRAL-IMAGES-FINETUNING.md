# Analyse Stratégique — Mistral Images & Fine-Tuning pour DeepSight
*Avril 2026*

---

## Mission 1 : Remplacer le pipeline d'images par Mistral (Flux via Agents API)

### État actuel du pipeline "Le Saviez-Vous"

Le pipeline est **déjà implémenté** dans `backend/src/images/keyword_images.py` avec une architecture en 2 étapes :

| Étape | Actuel | Modèle | Coût/image |
|-------|--------|--------|------------|
| Stage 1 — Art Director | Mistral Small 2503 | Génère la métaphore visuelle créative (JSON) | ~0.001€ |
| Stage 2 — Free | FLUX Schnell via Together AI | Génère l'image 512x512 | ~0.003€ |
| Stage 2 — Premium | DALL-E 3 via OpenAI | Génère l'image 512x512 | ~0.04€ |

**Post-processing** : Resize 512x512 → WebP (quality 85) → Upload R2 CDN → Cache PostgreSQL (`keyword_images` table).

### Ce que Mistral propose maintenant

Mistral a intégré la **génération d'images comme outil built-in** dans son Agents API, propulsé par **Black Forest Labs FLUX 1.1 [pro] Ultra** — un modèle nettement supérieur à FLUX Schnell.

| Aspect | Actuel (Together AI) | Mistral Agents API |
|--------|---------------------|-------------------|
| Modèle | FLUX.1 Schnell (gratuit, basique) | FLUX 1.1 Pro Ultra (premium) |
| Qualité | Correcte, parfois floue | Nettement supérieure, photoréaliste |
| Coût | ~0.003€/image | Inclus dans l'appel agent (à vérifier quota) |
| Intégration | 2 APIs séparées (Mistral + Together) | 1 seul appel Mistral |
| Pipeline | Stage 1 → Stage 2 = 2 calls | Agent unique avec tool = 1 call |

### Proposition : Fusionner les 2 stages en un seul appel Agent

**Avant** (actuel) :
```
Appel 1: Mistral Small → génère prompt créatif (JSON)
Appel 2: Together AI FLUX Schnell → génère image depuis prompt
= 2 services, 2 API keys, 2 points de failure
```

**Après** (proposition) :
```
Appel 1: Mistral Agent (avec tool image_generation) 
→ L'agent reçoit le terme + style DeepSight
→ Il génère l'image directement via FLUX Pro Ultra
= 1 service, 1 API key, 1 point de failure, meilleure qualité
```

### Avantages

1. **Simplification** : Plus besoin de Together AI (1 dépendance en moins)
2. **Qualité** : FLUX Pro Ultra >> FLUX Schnell (photoréalisme, détails, cohérence)
3. **Cohérence stack** : Tout passe par Mistral (DeepSight = 100% Mistral)
4. **Coût potentiel** : Si inclus dans le tier Scale de Mistral, possiblement moins cher
5. **Art Direction intégrée** : L'agent peut raisonner sur le meilleur visuel ET le générer en une passe

### Risques & Points d'attention

1. **Pricing flou** : La doc Mistral ne détaille pas le coût par image via l'Agents API. Sur Le Chat (consumer), c'est 40 images/mois gratuit. Via API, à confirmer.
2. **Contrôle du prompt** : Avec le pipeline actuel, on contrôle finement le prompt DALL-E/Flux. Avec l'Agent, on délègue la formulation — il faut tester si le style "still-life fond noir lumière dorée" est bien respecté.
3. **Format de sortie** : L'image est retournée comme `file_id` qu'il faut re-télécharger. Plus lourd que le base64 direct de Together AI.
4. **Bug existant** : `get_together_key()` n'est pas défini dans `core/config.py` — le pipeline free actuel est probablement cassé en prod.

### Recommandation Mission 1

**GO — avec POC d'abord.** Implémenter un `_stage2_mistral_agent()` comme 3ème option dans le pipeline, tester la qualité et le coût, puis remplacer progressivement Together AI. Garder DALL-E 3 en fallback premium.

---

## Mission 2 : Fine-tuning Mistral pour la qualité des analyses

### Contexte

DeepSight utilise 3 tiers de modèles Mistral pour les analyses vidéo :

| Plan | Modèle | Coût input/output (par 1M tokens) |
|------|--------|-----------------------------------|
| Free | mistral-small-2603 | 0.10€ / 0.30€ |
| Pro | mistral-medium-2508 | ~0.40€ / ~1.20€ |
| Expert | mistral-large-2512 | 2.00€ / 6.00€ |

### Ce que le fine-tuning Mistral permet

Mistral permet de fine-tuner les modèles **Small** et **Medium** via leur API :

| Aspect | Détail |
|--------|--------|
| Modèles fine-tunables | Small 3.1, Medium 3 |
| Méthodes | Supervised fine-tuning, LoRA |
| Coût training | 1€–9€ par million de tokens d'entraînement |
| Coût minimum | 4€ par job |
| Stockage modèle | 2€/mois |
| Coût inférence | Même prix que le modèle de base |

### Scénario réaliste pour DeepSight

**Objectif** : Fine-tuner Mistral Small pour qu'il produise des analyses de qualité proche de Mistral Large, à 10x moins cher.

**Données nécessaires** :
- ~500-2000 paires (transcript vidéo → analyse de qualité) 
- Les analyses doivent être "gold standard" (générées par Large, vérifiées humainement)
- Format : JSONL avec prompt système DeepSight + transcript + analyse attendue

**Estimation des coûts de training** :
- 1000 exemples × ~3000 tokens/exemple = ~3M tokens
- Coût : ~3€–27€ par run de training
- Stockage : 2€/mois
- **Total pour démarrer : ~30-50€**

**Économie potentielle en inférence** :
- Si un Small fine-tuné remplace Medium pour les plans Pro :
  - Avant : ~0.40€/M input → Après : ~0.10€/M input = **75% de réduction**
- Si un Small fine-tuné remplace Large pour certains cas :
  - Avant : 2.00€/M input → Après : 0.10€/M input = **95% de réduction**

### Faisabilité pour un solo dev

| Critère | Évaluation |
|---------|------------|
| Coût initial | ✅ Très abordable (~30-50€) |
| Complexité technique | ⚠️ Moyenne — il faut constituer le dataset |
| Temps | ⚠️ 2-3 jours pour le dataset, quelques heures pour le training |
| ROI | ✅ Excellent si >1000 analyses/mois |
| Maintenance | ⚠️ Re-fine-tuner quand les prompts changent |

### Le vrai défi : constituer le dataset

C'est LE point bloquant. Options :

1. **Semi-automatique (Recommandé)** : Générer 1000 analyses avec Mistral Large, noter les meilleures, les utiliser comme training data pour Small. Coût : ~20€ en appels Large.

2. **À partir de l'historique** : Extraire les analyses existantes de la DB PostgreSQL (table `summaries`), filtrer celles avec les meilleurs retours utilisateurs. Gratuit mais demande du travail de curation.

3. **Itératif** : Commencer avec 200 exemples, évaluer, ajouter progressivement. Plus prudent.

### Recommandation Mission 2

**GO PRUDENT — approche itérative.** Le fine-tuning Mistral est très abordable pour DeepSight. La stratégie recommandée :

1. **Phase 1** (1 jour) : Extraire 200 "meilleures analyses" de la DB prod
2. **Phase 2** (1 jour) : Générer 300 analyses supplémentaires avec Large → valider
3. **Phase 3** (2h) : Lancer le fine-tuning de Small via l'API Mistral
4. **Phase 4** (1 jour) : A/B test — comparer Small fine-tuné vs Medium sur 50 vidéos
5. **Phase 5** : Si résultats OK → déployer Small fine-tuné pour le plan Pro

**Budget total estimé : ~50-80€** pour un potentiel de 75% de réduction des coûts d'inférence.

---

## Résumé des recommandations

| Mission | Verdict | Priorité | Budget | Timeline |
|---------|---------|----------|--------|----------|
| **M1 — Images Mistral** | ✅ GO (POC) | Haute | ~0€ (si inclus dans Scale) | 1-2 jours |
| **M2 — Fine-tuning** | ✅ GO (itératif) | Moyenne | ~50-80€ | 1 semaine |

### Actions immédiates

1. **Fixer le bug** `get_together_key()` manquant dans `core/config.py`
2. **POC Mission 1** : Créer `_stage2_mistral_agent()` dans `keyword_images.py`
3. **Tester** la qualité des images Mistral Agent vs Together FLUX Schnell
4. **Commencer** la collecte de données pour le fine-tuning (extraire les meilleures analyses de prod)

---

*Document généré le 11 avril 2026 — DeepSight Strategic Analysis*
