---
allowed-tools: Read, Edit, Write, Grep, Glob
description: Système de souscription DeepSight — 5 plans, matrice features, is_feature_available(), Stripe
---

# Système de Souscription

Implémenter / vérifier pour : $ARGUMENTS

## 5 Plans : decouverte (gratuit), etudiant (2.99), starter (5.99), pro (12.99), equipe (29.99)

## Matrice features
| Feature | decouverte | etudiant | starter | pro | equipe |
|---------|:---:|:---:|:---:|:---:|:---:|
| analyses/mois | 3 | 20 | 50 | ∞ | ∞ |
| modes | accessible | +standard | +expert | tous | tous |
| flashcards/quiz | ❌ | ✅ | ✅ | ✅ | ✅ |
| mindmap/factcheck | ❌ | ❌ | ✅ | ✅ | ✅ |
| compare_videos | ❌ | ❌ | ❌ | ✅ | ✅ |
| team_workspace | ❌ | ❌ | ❌ | ❌ | ✅ |

## Backend SSOT
```python
def is_feature_available(plan, feature, platform="web") -> bool:
    # Vérifie plan >= min_plan requis ET platform supportée
```
Erreur 403 avec `{"code": "INSUFFICIENT_PLAN", "required_plan": "pro", "current_plan": user.plan}`

## Frontend (UI only, pas sécurité)
```typescript
const { hasAccess, requiredPlan } = useFeatureAccess(feature)
// <FeatureGate feature="compare_videos"><CompareButton /></FeatureGate>
```

## Stripe : checkout.session.completed → upgrade, customer.subscription.deleted → downgrade decouverte

## Règles absolues
1. Vérification TOUJOURS côté backend
2. L'UI cache mais ne sécurise pas
3. Tout changement = webhook Stripe
4. 403 avec required_plan dans la réponse