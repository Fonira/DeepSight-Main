---
description: "Référence complète du système de souscription DeepSight : 5 plans, matrice de features, is_feature_available(), gestion Stripe, et règles d'affichage UI."
---

# Système de Souscription DeepSight — SSOT

## Les 5 plans

| Plan | Prix | Cible |
|------|------|-------|
| `decouverte` | Gratuit | Acquisition |
| `etudiant` | 2.99€/mois | Étudiants |
| `starter` | 5.99€/mois | Usage régulier |
| `pro` | 12.99€/mois | Professionnels |
| `equipe` | 29.99€/mois | Teams |

## Matrice des features

| Feature | decouverte | etudiant | starter | pro | equipe |
|---------|:---:|:---:|:---:|:---:|:---:|
| analyses_per_month | 3 | 20 | 50 | ∞ | ∞ |
| analysis_modes | accessible | +standard | +expert | tous | tous |
| flashcards | ❌ | ✅ | ✅ | ✅ | ✅ |
| quiz | ❌ | ✅ | ✅ | ✅ | ✅ |
| mindmap | ❌ | ❌ | ✅ | ✅ | ✅ |
| factcheck | ❌ | ❌ | ✅ | ✅ | ✅ |
| compare_videos | ❌ | ❌ | ❌ | ✅ | ✅ |
| export_pdf | ❌ | ❌ | ✅ | ✅ | ✅ |
| team_workspace | ❌ | ❌ | ❌ | ❌ | ✅ |
| api_access | ❌ | ❌ | ❌ | ✅ | ✅ |

## Backend — is_feature_available()

```python
PLAN_HIERARCHY = ["decouverte", "etudiant", "starter", "pro", "equipe"]

FEATURE_REQUIREMENTS = {
    "create_analysis":    {"min_plan": "decouverte", "platforms": ["web", "mobile", "extension"]},
    "flashcards":         {"min_plan": "etudiant",   "platforms": ["web", "mobile"]},
    "quiz":               {"min_plan": "etudiant",   "platforms": ["web", "mobile"]},
    "mindmap":            {"min_plan": "starter",    "platforms": ["web", "mobile"]},
    "factcheck":          {"min_plan": "starter",    "platforms": ["web", "mobile"]},
    "compare_videos":     {"min_plan": "pro",        "platforms": ["web"]},
    "export_pdf":         {"min_plan": "starter",    "platforms": ["web", "mobile"]},
    "team_workspace":     {"min_plan": "equipe",     "platforms": ["web"]},
    "api_access":         {"min_plan": "pro",        "platforms": ["web"]},
}

def is_feature_available(plan, feature, platform="web") -> bool:
    req = FEATURE_REQUIREMENTS[feature]
    if platform not in req["platforms"]: return False
    return PLAN_HIERARCHY.index(plan) >= PLAN_HIERARCHY.index(req["min_plan"])
```

### Usage dans les endpoints
```python
if not is_feature_available(user.plan, "compare_videos", platform="web"):
    raise HTTPException(status_code=403, detail={
        "code": "INSUFFICIENT_PLAN",
        "required_plan": "pro",
        "current_plan": user.plan,
    })
```

## Frontend — Hook useFeatureAccess

```typescript
export function useFeatureAccess(feature: string) {
  const { user } = useUser()
  const currentPlan = user?.plan ?? 'decouverte'
  const requiredPlan = FEATURE_MIN_PLAN[feature] ?? null
  const hasAccess = PLAN_HIERARCHY.indexOf(currentPlan) >= PLAN_HIERARCHY.indexOf(requiredPlan)
  return { hasAccess, requiredPlan, currentPlan }
}
```

## Composant FeatureGate

```typescript
export function FeatureGate({ feature, children, fallback }) {
  const { hasAccess, requiredPlan } = useFeatureAccess(feature)
  if (!hasAccess) return fallback ?? <UpgradePrompt requiredPlan={requiredPlan} feature={feature} />
  return <>{children}</>
}
// Usage: <FeatureGate feature="compare_videos"><CompareButton /></FeatureGate>
```

## Stripe — Checkout et Webhook

```python
@router.post("/api/v1/billing/checkout")
async def create_checkout_session(plan: str, user: User = Depends(get_current_user)):
    session = stripe.checkout.Session.create(
        customer_email=user.email,
        line_items=[{"price": price_ids[plan], "quantity": 1}],
        mode="subscription",
        metadata={"user_id": str(user.id), "plan": plan}
    )
    return {"data": {"checkout_url": session.url}}
```

Webhook events : `checkout.session.completed` → upgrade plan, `customer.subscription.deleted` → downgrade decouverte.

## Règles absolues

1. **Jamais vérifier les droits côté client seul**
2. **Backend = seul SSOT** via `is_feature_available()`
3. **L'UI cache des features (UX) mais ne les sécurise pas**
4. **Tout changement de plan passe par le webhook Stripe**
5. **Erreur 403 avec `required_plan`** dans la réponse