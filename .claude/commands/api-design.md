---
allowed-tools: Read, Edit, Write, Grep, Glob
description: Conventions API FastAPI DeepSight — endpoints, réponses, erreurs, auth, Pydantic
---

# API Design DeepSight

Créer / modifier l'endpoint : $ARGUMENTS

## Routes : `/api/v1/{ressource}` (pluriel, anglais, snake_case)
GET=lire, POST=créer/action, PUT=remplacer, PATCH=modifier, DELETE=supprimer

## Format réponse standard
Succès : `{"status": "success", "data": {...}, "message": "..."}`
Erreur : `{"status": "error", "error": {"code": "INSUFFICIENT_PLAN", "message": "...", "details": {}}}`
Paginé : + `"pagination": {"page", "per_page", "total", "total_pages"}`

## Codes erreur : VALIDATION_ERROR=422, NOT_FOUND=404, UNAUTHORIZED=401, INSUFFICIENT_PLAN=403, RATE_LIMITED=429, ANALYSIS_FAILED=500

## Pydantic : suffixer Request/Response, Field() avec description, type hints obligatoires, async def par défaut

## Auth : `user: User = Depends(get_current_user)` sur tous les endpoints protégés

## Feature check : `if not is_feature_available(user.plan, feature, platform): raise HTTPException(403, ...)`

## Compatibilité : vérifier si Web, Mobile, Extension appellent l'endpoint. snake_case dans JSON (frontend convertit en camelCase).

## Webhooks Stripe : vérifier signature AVANT traitement. Events : checkout.session.completed, subscription.updated/deleted, invoice.payment_failed