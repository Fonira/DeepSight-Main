---
allowed-tools: Read, Grep, Glob
description: Règles de sécurité transversales DeepSight — JWT, CORS, secrets, Stripe, CSP, validation, rate limiting
---

# Sécurité DeepSight

Vérifier / implémenter : $ARGUMENTS

## Principe : Zero Trust côté client
Tout vient du backend. Jamais faire confiance au client.

## JWT : HS256, access 30min, refresh 30j. Stockage : httpOnly cookie (web), expo-secure-store (mobile), chrome.storage.local (ext).

## CORS : Jamais `*` en prod. `CORS_ORIGINS` env var, domaines listés explicitement.

## Secrets : Jamais dans le code, jamais dans les logs. `.env` dans `.gitignore`. Rotation immédiate si exposé.

## Stripe Webhooks : Vérifier signature AVANT tout traitement. Idempotence via Redis `stripe_event:{id}` TTL 7j.

## Validation : Pydantic v2 sur toutes les entrées. `max_length` sur les textes. URL YouTube validée par regex.

## Rate Limiting : decouverte=10/min, etudiant=30, starter=60, pro=120, equipe=300.

## CSP Extension : `script-src 'self'; object-src 'self'`. Interdit : eval(), inline scripts, unsafe-inline.

## Checklist avant deploy
- SECRET_KEY >= 32 bytes
- CORS_ORIGINS prod only
- Webhook Stripe signature vérifiée
- Endpoints protégés `Depends(get_current_user)`
- `is_feature_available()` côté backend
- Rate limiting actif
- Pas de stack trace exposé en 500