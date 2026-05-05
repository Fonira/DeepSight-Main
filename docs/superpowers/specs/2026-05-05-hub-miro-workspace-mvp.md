# Hub Miro Workspace MVP — 2026-05-05

## Pitch

Étendre Miro (mergé prod via Débat IA, PR #318/#330) au Hub web `/hub` comme workspace agrégateur d'analyses. MVP **manuel et ciblé** : user sélectionne 3-N analyses, clique "Créer workspace", reçoit un board Miro mosaïque read-only embed dans le Hub. Mesure 2 semaines, élargir si signal vert.

## Scope MVP

- **Plateforme** : Web only (`HubPage.tsx`, route `/hub`). Mobile + Extension hors phase 1.
- **Cluster** : **manuel**. Multi-select dans `ConversationsDrawer` + bouton "Créer workspace" (3-10 analyses).
- **Board** : mosaïque thumbnails. 1 sticky par `Summary` (titre + thèse extraite de `content`), 3 colonnes, top-down par date.
- **Sync** : one-way push DeepSight → Miro à création. Read-only.
- **Persistance** : table `hub_workspace` (id, user_id, name, summary_ids[], miro_board_id, miro_view_link, created_at).
- **Gating** : **Expert only**. Justifie tier 19,99 €, plafonne coût Miro. Limite 5 workspaces actifs/mois.
- **Réutilisation** : `miro_service.py` + `generate_hub_workspace_board()` (mêmes helpers, même token admin). `DebateMiroEmbed` factorisé en `MiroBoardEmbed` générique.

## Architecture

```
[Hub /hub]
    │
    ├── ConversationsDrawer ──(multi-select)──► [Créer workspace]
    │                                                  │
    │                                                  ▼
    │                                  POST /api/hub/workspace
    │                                                  │
    │                                                  ▼
    │                            miro_service.generate_hub_workspace_board
    │                                                  │
    └── HubWorkspaceEmbed ◄── GET /api/hub/workspace/{id}
```

## Coût Miro projeté

**Hypothèses** : ~10 stickies/board, user Expert ≈ 2 workspaces/mois, plafond 5/mois.

- **Bloquant Free Miro** : 3 editable boards/account. Pattern token admin actuel sature dès le 4ᵉ.
- **Solution MVP** : compte DeepSight Miro en **Starter $8/mo** (boards illimités). Coût plancher ~$96/an.
- **À 100 users Expert × 2 workspaces/mois = 200 boards/mois** : reste $8/mo (Starter flat). Rate limit 2000 req/min largement OK.
- **Risque** : > 1000 users Expert → migrer vers OAuth user-level (phase 2).

## Métriques 2 semaines

1. **Activation** : % users Expert créant ≥1 workspace en 14j. Cible >15 %.
2. **Repeat** : % "créateurs" en créant ≥2. Cible >40 %.
3. **Embed open rate** : ouverture iframe (analytics). Cible >60 %.
4. **External CTR** : clics "Ouvrir dans Miro" (signal valeur réelle).
5. **Coût Miro réel** : surveiller boards/mois et rate limit.

## Out-of-scope phase 1

Auto-clustering sémantique (`TranscriptEmbedding`) ; bi-directionnel webhooks ; Mobile + Extension ; mind map cross-vidéos ; workspaces partagés entre users ; OAuth user-level.

## Questions ouvertes

- [ ] **Q1 — Gating tier** : Expert only (reco) **OU** Pro+Expert (élargit base test, dilue justif Expert) ?
- [ ] **Q2 — Limite workspaces/mois** : 5 (reco prudent) **OU** 10 **OU** illimité avec soft warning ?
- [ ] **Q3 — Naming UX** : "Workspace" (reco neutre) **OU** "Tableau" (collision Miro board) **OU** "Hub Board" (branding) ?
