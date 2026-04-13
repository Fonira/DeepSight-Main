---
name: asana-tasks
description: "Gestion des tâches Asana pour DeepSight. TOUJOURS consulter cette skill avant de créer, modifier, ou rechercher des tâches dans Asana. Déclenchement : toute mention de 'tâche', 'task', 'Asana', 'backlog', 'à faire', 'todo', 'créer une tâche', 'ajouter un bug', 'tracker', ou toute demande impliquant la gestion de tâches DeepSight."
---

# Asana DeepSight — Contexte & Conventions

## Workspace & Identifiants

| Élément              | Valeur                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| **Workspace**        | `deepsightsynthesis.com` (GID: `1214049486421124`)                     |
| **Projet principal** | `Maxime : premier projet` (GID: `1214026047482525`)                    |
| **Owner**            | Maxime Leparc (GID: `1214049486421111`, maxime@deepsightsynthesis.com) |

## Structure du projet

**1 projet unique** avec des **sections** pour organiser par plateforme :

- Backend (FastAPI / Hetzner)
- Frontend (React / Vercel)
- Mobile (Expo / EAS)
- Extension Chrome (MV3)
- Infra / DevOps
- Cross-platform

## Custom Fields disponibles

### Priorité (enum — GID: `1214026047482530`)

| Valeur  | GID                | Couleur       |
| ------- | ------------------ | ------------- |
| Faible  | `1214026047482531` | aqua          |
| Moyenne | `1214026047482532` | yellow-orange |
| Élevée  | `1214026047482533` | purple        |

### Statut (enum — GID: `1214026047482535`)

| Valeur          | GID                | Couleur    |
| --------------- | ------------------ | ---------- |
| Dans les délais | `1214026047482536` | blue-green |
| À risque        | `1214026047482537` | yellow     |
| En retard       | `1214026047482538` | red        |

## Conventions de création de tâches

### Format du titre

```
[SCOPE] Titre court et descriptif
```

Scopes valides : `BACK`, `FRONT`, `MOBILE`, `EXT`, `INFRA`, `CROSS`

Exemples :

- `[BACK] Fix rate limiting sur /api/analyze`
- `[FRONT] Ajouter skeleton loading page dashboard`
- `[MOBILE] Crash au lancement sur iOS 17`
- `[EXT] Adapter popup au nouveau design system`

### Description (notes)

Toujours inclure :

1. **Contexte** : Pourquoi cette tâche existe (1-2 phrases)
2. **Détails techniques** : Fichiers concernés, approche suggérée
3. **Critères d'acceptation** : Comment vérifier que c'est fait

### Assignation

- Toujours assigner à Maxime Leparc (GID: `1214049486421111`) sauf indication contraire

### Priorité par défaut

- Bugs critiques → **Élevée**
- Bugs non-critiques → **Moyenne**
- Features → **Moyenne**
- Améliorations / refacto → **Faible**
- Infra / sécurité → **Élevée**

### Statut par défaut

- Nouvelles tâches → **Dans les délais**

## Workflow type

```
Création tâche → En cours (in_progress) → Review → Done (completed)
```

## Outils MCP Asana disponibles

| Action                    | Outil                                      |
| ------------------------- | ------------------------------------------ |
| Chercher tâches/projets   | `search_objects` ou `search_tasks_preview` |
| Créer une tâche           | `create_task_preview`                      |
| Voir une tâche            | `get_task`                                 |
| Modifier une tâche        | `update_tasks`                             |
| Supprimer une tâche       | `delete_task`                              |
| Lister tâches d'un projet | `get_tasks`                                |
| Voir le projet            | `get_project`                              |
| Ajouter un commentaire    | `add_comment`                              |

## Exemples d'utilisation

### Créer un bug

```
Titre: [BACK] 500 sur /api/v1/analysis quand transcript vide
Description:
  Contexte: L'endpoint crash quand Supadata retourne un transcript vide.
  Fichiers: backend/app/api/v1/analysis.py, backend/app/services/transcript.py
  Critères: Retourner une 400 avec message explicite au lieu de 500.
Priorité: Élevée
Statut: Dans les délais
Assignee: Maxime Leparc
```

### Créer une feature

```
Titre: [FRONT] Dashboard analytics avec graphiques de rétention
Description:
  Contexte: Les utilisateurs Pro veulent voir leurs stats d'utilisation.
  Fichiers: frontend/src/pages/Dashboard/, frontend/src/components/charts/
  Critères: Graphique rétention 7j/30j, nombre d'analyses par type.
Priorité: Moyenne
Statut: Dans les délais
Assignee: Maxime Leparc
```

## Règles strictes

1. **TOUJOURS** utiliser le format `[SCOPE] Titre` pour les titres
2. **TOUJOURS** assigner à Maxime sauf demande contraire
3. **TOUJOURS** mettre une priorité cohérente avec le type de tâche
4. **JAMAIS** créer de tâche sans description/contexte
5. **JAMAIS** dupliquer une tâche — chercher d'abord si elle existe avec `search_objects`
6. Après création, **confirmer** le lien Asana à l'utilisateur
