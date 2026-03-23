---
allowed-tools: Read, Edit, Write, Grep, Glob
description: Conventions analytics PostHog DeepSight — events, funnels, feature flags
---

# PostHog Analytics

Implémenter le tracking pour : $ARGUMENTS

## Nomenclature : `objet_action` en snake_case (passé/accompli)

### Events core
analysis_started/completed/failed/viewed, flashcards_generated, quiz_started/completed, feature_gate_shown, upgrade_clicked, checkout_started/completed/abandoned, subscription_cancelled, onboarding_started/completed, first_analysis_created, share_link_created/clicked

## Implémentation
- Web : `posthog.capture(event, { ...props, user_plan, platform: 'web' })`
- Mobile : `posthog.capture(event, { ...props, platform: 'mobile' })`
- Backend (server-side) : `ph.capture(distinct_id=user_id, event=event, properties={..., "platform": "server"})`
- Toujours inclure `user_plan` et `platform`
- Autocapture OFF, tracking manuel uniquement

## Funnels
1. Activation : inscription → 1ère analyse → résultat vu → Studio utilisé
2. Conversion : feature_gate_shown → upgrade_clicked → checkout_started → completed
3. Rétention : cohorte inscription → revient analyser

## Feature Flags : kebab-case (`new-expert-mode-v2`, `pricing-annual-display`)

## Super-properties : `posthog.register({ user_plan, platform, app_version, locale })`