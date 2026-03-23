---
description: "Conventions d'instrumentation analytics PostHog pour DeepSight. TOUJOURS consulter cette skill avant d'ajouter un event de tracking, implémenter un funnel, créer une feature flag, ou analyser les données produit."
---

# PostHog Analytics — DeepSight

## Philosophie : tracker ce qui aide à décider

Chaque event doit répondre à une question business.

## Setup par plateforme

### Frontend Web
```typescript
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: 'https://eu.posthog.com',
  capture_pageview: true, autocapture: false,
})
```

### Mobile (Expo)
```typescript
import PostHog from 'posthog-react-native'
export const posthog = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY!, {
  host: 'https://eu.posthog.com', disabled: __DEV__,
})
```

### Backend (events server-side)
```python
from posthog import Posthog
ph = Posthog(project_api_key=os.environ["POSTHOG_API_KEY"], host="https://eu.posthog.com")
```

## Nomenclature des events

Format : `objet_action` en snake_case, passé/accompli.

### Events core
```
analysis_started, analysis_completed, analysis_failed, analysis_viewed
flashcards_generated, flashcard_reviewed, quiz_started, quiz_completed
mindmap_viewed, factcheck_completed
feature_gate_shown, upgrade_clicked, checkout_started, checkout_completed
checkout_abandoned, subscription_cancelled
onboarding_started, onboarding_step_completed, onboarding_completed
first_analysis_created, share_link_created, share_link_clicked
```

## Hook useAnalytics (Web)

```typescript
export function useAnalytics() {
  const { user } = useUser()
  const track = (event: string, properties: Record<string, unknown> = {}) => {
    posthog.capture(event, { ...properties, user_plan: user?.plan ?? 'decouverte', platform: 'web' })
  }
  return { track, trackAnalysisStarted, trackFeatureGate, trackUpgradeClick }
}
```

## Funnels prioritaires

1. **Activation (J0-J7)** : inscription → première_analyse → résultat_vu → feature_studio_utilisée
2. **Conversion** : feature_gate_shown → upgrade_clicked → checkout_started → checkout_completed
3. **Rétention** : Cohorte par date d'inscription → revient faire une analyse

## Feature Flags — Conventions

Format kebab-case : `new-expert-mode-v2`, `pricing-annual-display`, `onboarding-video-step`

## Super-properties (toujours envoyées)

```typescript
posthog.register({ user_plan: user.plan, platform: 'web', app_version: '2.0.0', locale: navigator.language })
```

## Dashboard — Métriques clés

| Métrique | Cible |
|----------|-------|
| DAU/MAU ratio | > 20% |
| Analyses/user/mois | > 5 (payants) |
| Feature gate → upgrade | > 3% |
| Checkout → completed | > 70% |
| Time to first analysis | < 5 min |
| % users utilisant Studio | > 40% (payants) |