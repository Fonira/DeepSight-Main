# Obsidian Vault Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le vault Obsidian fondateur (`C:\Users\33667\Vault\`) qui devient la source de vérité unique pour DeepSight et les autres projets de code de Maxime, avec migration du contenu Claude existant et préservation de l'auto-load Claude Code via junctions/imports.

**Architecture:** Vault Obsidian unique au root du home directory, organisé en `00-Inbox / 01-Projects / 02-Meta / 03-Archive / Templates`. Chaque projet a une sous-structure standardisée (`_index.md`, `Specs/`, `Decisions/`, `Bugs/`, `Ideas/`, `Sessions/`). Migration en 3 vagues : Claude global → DeepSight pilote → autres projets. Liens vers repos via junctions Windows (`mklink /J`) ou imports Markdown Claude Code (`@path`).

**Tech Stack:** Obsidian (Sync Plus), Windows 11 PowerShell 5.1, plugins Obsidian (Templater, Dataview, Obsidian Git, Tag Wrangler, Auto Note Mover), `mklink` natif Windows.

---

## Préparation : état actuel

**Vault Obsidian existant** : `C:\Users\33667\Documents\Obsidian Vault\`
Contenu :

- `Bienvenue.md` (218 octets, doc d'accueil par défaut)
- `Dees sight popo.md` (0 octets, note de test)
- `Sans titre.canvas` (2 octets, canvas vide)
- `.obsidian/` (config + plugins déjà installés à 0)

**Aucun contenu utilisateur significatif** — déplacement sans risque.

**Cible** : `C:\Users\33667\Vault\`

---

## File Structure

### À créer (structure du vault, après déplacement)

```
C:\Users\33667\Vault\                         # vault root (déplacé depuis Documents)
├── 00-Inbox\
├── 01-Projects\
│   └── DeepSight\
│       ├── _index.md                          # ex-CLAUDE.md projet
│       ├── Specs\                             # ex-docs/superpowers/specs/
│       ├── Decisions\
│       ├── Bugs\
│       ├── Ideas\
│       └── Sessions\
├── 02-Meta\
│   ├── Claude\
│   │   ├── global.md                          # ex-C:\Users\33667\CLAUDE.md
│   │   └── Memory\                            # ex-.claude/projects/.../memory/*.md
│   ├── Patterns\
│   ├── Stack\
│   └── Conventions\
├── 03-Archive\
└── Templates\
    ├── _index.md
    ├── spec.md
    ├── decision.md
    ├── bug.md
    ├── session.md
    └── idea.md
```

### À modifier (liens depuis les paths d'origine)

- `C:\Users\33667\CLAUDE.md` → import `@C:/Users/33667/Vault/02-Meta/Claude/global.md`
- `C:\Users\33667\.claude\projects\C--Users-33667\memory\` → junction vers `C:\Users\33667\Vault\02-Meta\Claude\Memory\`
- `C:\Users\33667\DeepSight-Main\CLAUDE.md` → import `@C:/Users/33667/Vault/01-Projects/DeepSight/_index.md`
- `C:\Users\33667\DeepSight-Main\docs\superpowers\specs\` → laisser tel quel (Git-versionné dans le repo, ne pas casser) ; copier le contenu vers le vault sans junction côté repo

### À ajouter (DeepSight repo)

- `docs/superpowers/specs/2026-04-27-obsidian-vault-foundation-design.md` (déjà créé)
- `docs/superpowers/plans/2026-04-27-obsidian-vault-foundation.md` (ce fichier)

---

## Phase A — Déplacement du vault au bon path

### Task 1: Fermer Obsidian et inspecter le vault actuel

**Files:**

- Read: `C:\Users\33667\Documents\Obsidian Vault\`

- [ ] **Step 1: Fermer Obsidian complètement**

Action utilisateur : clic droit sur l'icône Obsidian dans la barre des tâches → Quitter. Vérifier qu'aucun process `Obsidian.exe` ne tourne :

```powershell
Get-Process Obsidian -ErrorAction SilentlyContinue
```

Expected output : aucun process listé (sortie vide).

- [ ] **Step 2: Lister le contenu actuel du vault**

```bash
ls -la "C:/Users/33667/Documents/Obsidian Vault/"
```

Expected output : `Bienvenue.md`, `Dees sight popo.md`, `Sans titre.canvas`, dossier `.obsidian/`.

- [ ] **Step 3: Sauvegarder le contenu actuel dans Inbox (à faire après création de la structure, voir Task 4)**

Note : on déplacera `Bienvenue.md` et `Dees sight popo.md` dans `00-Inbox/` une fois le vault structuré, pour éviter de les perdre. Le canvas vide peut être supprimé.

### Task 2: Déplacer le vault vers `C:\Users\33667\Vault\`

**Files:**

- Move: `C:\Users\33667\Documents\Obsidian Vault\` → `C:\Users\33667\Vault\`

- [ ] **Step 1: Vérifier qu'il n'y a pas déjà un `C:\Users\33667\Vault\`**

```bash
ls C:/Users/33667/Vault 2>/dev/null && echo "EXISTS - aborting" || echo "OK - safe to create"
```

Expected output : `OK - safe to create`.

- [ ] **Step 2: Déplacer le dossier**

```powershell
Move-Item "C:\Users\33667\Documents\Obsidian Vault" "C:\Users\33667\Vault"
```

Expected : aucun output, le dossier est déplacé.

- [ ] **Step 3: Vérifier le déplacement**

```bash
ls -la "C:/Users/33667/Vault/" && echo "---" && ls "C:/Users/33667/Documents/" | grep -i obsidian
```

Expected : contenu visible dans `Vault/` et aucune ligne `Obsidian Vault` sous `Documents/`.

### Task 3: Rouvrir le vault dans Obsidian au nouveau path

**Files:** (aucun, action GUI)

- [ ] **Step 1: Ouvrir Obsidian**

Action utilisateur : lancer Obsidian. Au démarrage, il va probablement afficher "Vault not found" pour le path précédent.

- [ ] **Step 2: Ajouter le vault au nouveau path**

Action utilisateur : dans le sélecteur de vault Obsidian → "Open folder as vault" → naviguer vers `C:\Users\33667\Vault\` → Open.

- [ ] **Step 3: Retirer l'ancienne entrée du sélecteur**

Action utilisateur : dans le sélecteur, supprimer l'entrée pointant vers `Documents\Obsidian Vault` (icône poubelle ou clic droit → Remove).

- [ ] **Step 4: Vérifier que Obsidian Sync est toujours connecté**

Action utilisateur : Settings → Sync → vérifier que le compte Maxime est toujours authentifié et que le statut affiche "Connected" ou "Synced". Si le vault était déjà associé à un Sync remote, créer une nouvelle association : Settings → Sync → "Choose remote vault" → sélectionner ou créer un remote portant le même nom.

---

## Phase B — Structure des dossiers

### Task 4: Créer l'arborescence complète du vault

**Files:**

- Create: tous les dossiers listés dans la section File Structure ci-dessus

- [ ] **Step 1: Créer les dossiers top-level et standards**

```bash
mkdir -p "C:/Users/33667/Vault/00-Inbox" \
         "C:/Users/33667/Vault/01-Projects" \
         "C:/Users/33667/Vault/02-Meta/Claude/Memory" \
         "C:/Users/33667/Vault/02-Meta/Patterns" \
         "C:/Users/33667/Vault/02-Meta/Stack" \
         "C:/Users/33667/Vault/02-Meta/Conventions" \
         "C:/Users/33667/Vault/03-Archive" \
         "C:/Users/33667/Vault/Templates"
```

Expected : aucun output.

- [ ] **Step 2: Créer la sous-structure DeepSight**

```bash
mkdir -p "C:/Users/33667/Vault/01-Projects/DeepSight/Specs" \
         "C:/Users/33667/Vault/01-Projects/DeepSight/Decisions" \
         "C:/Users/33667/Vault/01-Projects/DeepSight/Bugs" \
         "C:/Users/33667/Vault/01-Projects/DeepSight/Ideas" \
         "C:/Users/33667/Vault/01-Projects/DeepSight/Sessions"
```

- [ ] **Step 3: Vérifier l'arborescence**

```bash
find "C:/Users/33667/Vault" -type d 2>/dev/null | sort
```

Expected output (exactement ces lignes, dans cet ordre alphabétique) :

```
C:/Users/33667/Vault
C:/Users/33667/Vault/.obsidian
C:/Users/33667/Vault/00-Inbox
C:/Users/33667/Vault/01-Projects
C:/Users/33667/Vault/01-Projects/DeepSight
C:/Users/33667/Vault/01-Projects/DeepSight/Bugs
C:/Users/33667/Vault/01-Projects/DeepSight/Decisions
C:/Users/33667/Vault/01-Projects/DeepSight/Ideas
C:/Users/33667/Vault/01-Projects/DeepSight/Sessions
C:/Users/33667/Vault/01-Projects/DeepSight/Specs
C:/Users/33667/Vault/02-Meta
C:/Users/33667/Vault/02-Meta/Claude
C:/Users/33667/Vault/02-Meta/Claude/Memory
C:/Users/33667/Vault/02-Meta/Conventions
C:/Users/33667/Vault/02-Meta/Patterns
C:/Users/33667/Vault/02-Meta/Stack
C:/Users/33667/Vault/03-Archive
C:/Users/33667/Vault/Templates
```

### Task 5: Déplacer les notes existantes vers Inbox

**Files:**

- Move: `Bienvenue.md`, `Dees sight popo.md` → `00-Inbox/`
- Delete: `Sans titre.canvas` (vide, inutile)

- [ ] **Step 1: Déplacer les notes existantes**

```bash
mv "C:/Users/33667/Vault/Bienvenue.md" "C:/Users/33667/Vault/00-Inbox/Bienvenue.md"
mv "C:/Users/33667/Vault/Dees sight popo.md" "C:/Users/33667/Vault/00-Inbox/Dees sight popo.md"
```

- [ ] **Step 2: Supprimer le canvas vide**

```bash
rm "C:/Users/33667/Vault/Sans titre.canvas"
```

- [ ] **Step 3: Vérifier**

```bash
ls "C:/Users/33667/Vault/" && echo "---" && ls "C:/Users/33667/Vault/00-Inbox/"
```

Expected : root contient juste les dossiers de structure ; Inbox contient les 2 notes.

---

## Phase C — Plugins Obsidian

> Tous les plugins s'installent depuis l'Obsidian GUI. Action utilisateur essentiellement.

### Task 6: Activer les plugins communautaires

**Files:** (aucun, action GUI)

- [ ] **Step 1: Activer l'accès aux plugins communautaires**

Action utilisateur : Settings → Community plugins → cliquer "Turn on community plugins" si ce n'est pas déjà fait. Confirmer le warning de sécurité.

- [ ] **Step 2: Vérifier l'activation**

Settings → Community plugins → la section "Browse" doit être accessible.

### Task 7: Installer Templater

- [ ] **Step 1: Browse → chercher "Templater"**

Settings → Community plugins → Browse → taper "Templater" → cliquer sur le plugin de SilentVoid13.

- [ ] **Step 2: Install + Enable**

Cliquer "Install", puis "Enable".

- [ ] **Step 3: Configurer le dossier des templates**

Settings → Templater → "Template folder location" → entrer `Templates`. Sauvegarder.

- [ ] **Step 4: Vérifier**

Settings → Templater → confirmer que "Template folder location" affiche `Templates`.

### Task 8: Installer Dataview

- [ ] **Step 1: Browse → installer Dataview**

Settings → Community plugins → Browse → "Dataview" (de Michael Brenan) → Install → Enable.

- [ ] **Step 2: Vérifier**

Settings → Dataview → la page de config s'affiche sans erreur. Laisser les paramètres par défaut.

### Task 9: Installer Obsidian Git

- [ ] **Step 1: Browse → installer Obsidian Git**

Settings → Community plugins → Browse → "Obsidian Git" (de Vinzent) → Install → Enable.

- [ ] **Step 2: Initialiser un repo Git dans le vault**

Soit via le plugin (commande "Obsidian Git: Initialize a new repo"), soit via shell :

```bash
cd "C:/Users/33667/Vault" && git init && git config user.email "maximeleparc3@gmail.com" && git config user.name "Maxime Leparc"
```

Expected : `Initialized empty Git repository in C:/Users/33667/Vault/.git/`

- [ ] **Step 3: Créer un `.gitignore` pour le vault**

```bash
cat > "C:/Users/33667/Vault/.gitignore" << 'EOF'
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.trash/
EOF
```

- [ ] **Step 4: Premier commit**

```bash
cd "C:/Users/33667/Vault" && git add .gitignore && git commit -m "chore: init vault git repo"
```

Expected : `1 file changed, 3 insertions(+)`.

### Task 10: Installer Tag Wrangler

- [ ] **Step 1: Browse → installer Tag Wrangler**

Settings → Community plugins → Browse → "Tag Wrangler" (de pjeby) → Install → Enable.

- [ ] **Step 2: Vérifier**

Le panneau de tags (gauche) devrait maintenant supporter clic droit → Rename tag.

### Task 11: Installer Auto Note Mover

- [ ] **Step 1: Browse → installer Auto Note Mover**

Settings → Community plugins → Browse → "Auto Note Mover" (de farux0r) → Install → Enable.

- [ ] **Step 2: Configurer une règle de base**

Settings → Auto Note Mover → ajouter une règle : tag `#projet/deepsight` → folder `01-Projects/DeepSight`. Cette règle servira à classer automatiquement une note de l'Inbox quand elle reçoit le tag projet.

---

## Phase D — Templates

> Chaque template est un fichier Markdown placé dans `Templates/`. Templater interpole les variables `<% tp.* %>` au moment d'utiliser le template.

### Task 12: Créer le template `_index.md`

**Files:**

- Create: `C:\Users\33667\Vault\Templates\_index.md`

- [ ] **Step 1: Écrire le template**

Créer le fichier avec ce contenu exact :

```markdown
---
title: <% tp.file.title %>
type: project-index
tags:
  - projet/<% tp.file.title.toLowerCase() %>
  - type/index
created: <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.file.title %>

## Vue d'ensemble

> Une phrase qui résume ce projet.

## Stack

- **Backend** :
- **Frontend** :
- **Mobile** :
- **Infra** :

## URLs

- **Prod** :
- **Staging** :
- **Repo** :

## Status global

- **Phase actuelle** :
- **Prochaine milestone** :

## Quotas / limites

> Plans, quotas, limites métier importantes.

## Liens clés

- [[Specs/]] — Specs en cours
- [[Decisions/]] — ADRs récents
- [[Bugs/]] — Bugs ouverts

## Contacts / comptes

- **Email** :
- **Stripe** :
- **VPS** :

## Notes
```

- [ ] **Step 2: Vérifier**

```bash
cat "C:/Users/33667/Vault/Templates/_index.md" | head -10
```

Expected : voir les 10 premières lignes incluant `---` du frontmatter et `title: <% tp.file.title %>`.

### Task 13: Créer le template `spec.md`

**Files:**

- Create: `C:\Users\33667\Vault\Templates\spec.md`

- [ ] **Step 1: Écrire le template (clone du format superpowers)**

```markdown
---
title: <% tp.file.title %>
type: spec
tags:
  - type/spec
  - status/draft
created: <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.file.title %>

**Date** : <% tp.date.now("YYYY-MM-DD") %>
**Status** : Draft

---

## 1. Contexte & motivation

> Pourquoi on fait ça. Quel problème résout-on ?

## 2. Objectifs (in scope)

1.

## 3. Hors périmètre

-

## 4. Décisions architecturales

### 4.1.

## 5. Critères de succès

- [ ]

## 6. Questions ouvertes

1.
```

### Task 14: Créer le template `decision.md` (ADR)

**Files:**

- Create: `C:\Users\33667\Vault\Templates\decision.md`

- [ ] **Step 1: Écrire le template ADR**

```markdown
---
title: <% tp.file.title %>
type: decision
tags:
  - type/decision
  - status/proposed
created: <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.file.title %>

**Date** : <% tp.date.now("YYYY-MM-DD") %>
**Status** : Proposed | Accepted | Deprecated | Superseded
**Décideurs** :

## Contexte

> Quelle force motrice impose une décision ? Quelles contraintes ?

## Décision

> Ce qu'on décide de faire, formulé à l'impératif.

## Conséquences

### Positives

-

### Négatives

-

### Neutres

-

## Alternatives considérées

### Alternative A

**Pour :**
**Contre :**

### Alternative B

**Pour :**
**Contre :**

## Références

-
```

### Task 15: Créer le template `bug.md`

**Files:**

- Create: `C:\Users\33667\Vault\Templates\bug.md`

- [ ] **Step 1: Écrire le template bug**

```markdown
---
title: <% tp.file.title %>
type: bug
tags:
  - type/bug
  - status/open
created: <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.file.title %>

**Date** : <% tp.date.now("YYYY-MM-DD") %>
**Status** : Open | In progress | Fixed | Wontfix
**Sévérité** : Critique | Majeur | Mineur

## Symptôme

> Ce que voit l'utilisateur.

## Repro steps

1.
2.
3.

**Résultat attendu** :
**Résultat observé** :

## Environnement

- Navigateur / Device :
- Version :
- URL :

## Root cause

> L'origine technique du problème, après investigation.

## Fix

> Ce qui a été modifié pour corriger.

## Prevention

> Comment éviter que ça revienne (test, refacto, garde-fou).
```

### Task 16: Créer le template `session.md`

**Files:**

- Create: `C:\Users\33667\Vault\Templates\session.md`

- [ ] **Step 1: Écrire le template session**

```markdown
---
title: <% tp.file.title %>
type: session
tags:
  - type/session
created: <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.file.title %>

**Date** : <% tp.date.now("YYYY-MM-DD HH:mm") %>
**Projet** :

## Goal

> Quel était l'objectif de la session ?

## Done

-

## Blockers

-

## Next steps

-

## Notes brutes
```

### Task 17: Créer le template `idea.md`

**Files:**

- Create: `C:\Users\33667\Vault\Templates\idea.md`

- [ ] **Step 1: Écrire le template idea**

```markdown
---
title: <% tp.file.title %>
type: idea
tags:
  - type/idea
  - status/open
created: <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.file.title %>

**Date** : <% tp.date.now("YYYY-MM-DD") %>
**Status** : Open | Validated | Rejected | Implemented

## Problème adressé

> Quel besoin/frustration cette idée résout ?

## Esquisse de solution

> Comment ça pourrait marcher.

## Coût estimé

> XS | S | M | L | XL

## Impact estimé

> XS | S | M | L | XL

## Notes
```

- [ ] **Step Final phase D: Commit dans le vault**

```bash
cd "C:/Users/33667/Vault" && git add Templates/ && git commit -m "feat(templates): add 6 base templates (_index, spec, decision, bug, session, idea)"
```

Expected : `6 files changed`.

---

## Phase E — Migration Claude global

### Task 18: Copier le CLAUDE.md global vers le vault

**Files:**

- Copy: `C:\Users\33667\CLAUDE.md` → `C:\Users\33667\Vault\02-Meta\Claude\global.md`

- [ ] **Step 1: Sauvegarder l'original avant modification**

```bash
cp "C:/Users/33667/CLAUDE.md" "C:/Users/33667/CLAUDE.md.backup-2026-04-27"
```

- [ ] **Step 2: Copier vers le vault**

```bash
cp "C:/Users/33667/CLAUDE.md" "C:/Users/33667/Vault/02-Meta/Claude/global.md"
```

- [ ] **Step 3: Vérifier le contenu**

```bash
diff "C:/Users/33667/CLAUDE.md" "C:/Users/33667/Vault/02-Meta/Claude/global.md" && echo "OK identical"
```

Expected output : `OK identical`.

- [ ] **Step 4: Ajouter le frontmatter Obsidian dans la version vault**

Éditer `C:/Users/33667/Vault/02-Meta/Claude/global.md` pour ajouter en haut (avant la première ligne `# Contexte Global Arinov`) :

```markdown
---
title: Contexte global Arinov (Claude)
type: meta-claude
tags:
  - type/meta
  - claude/global
updated: 2026-04-27
---
```

### Task 19: Remplacer le CLAUDE.md d'origine par un import

**Files:**

- Modify: `C:\Users\33667\CLAUDE.md` (devient un fichier "stub" qui importe le vault)

- [ ] **Step 1: Écrire la version stub**

```bash
cat > "C:/Users/33667/CLAUDE.md" << 'EOF'
# Contexte Global Arinov (stub → vault)

Ce fichier est un stub. La version canonique vit dans le vault Obsidian :

@C:/Users/33667/Vault/02-Meta/Claude/global.md

Pour modifier le contexte, éditer le fichier vault. Claude Code suit l'import `@` automatiquement.
EOF
```

- [ ] **Step 2: Vérifier**

```bash
cat "C:/Users/33667/CLAUDE.md"
```

Expected : 5 lignes courtes avec l'import `@`.

- [ ] **Step 3: Tester l'auto-load Claude Code**

Action utilisateur : ouvrir une nouvelle session Claude Code dans `C:\Users\33667\` (terminal → `claude`) et taper `/context`. Vérifier que le contenu du CLAUDE.md global est bien chargé (DeepSight, projets, mémoire, etc.).

Si ça ne marche pas (l'import `@` n'est pas suivi automatiquement) : revenir au plan A — copier intégralement le contenu vault dans le stub OU utiliser un hardlink :

```powershell
Remove-Item "C:\Users\33667\CLAUDE.md"
cmd /c mklink /H "C:\Users\33667\CLAUDE.md" "C:\Users\33667\Vault\02-Meta\Claude\global.md"
```

### Task 20: Migrer le système MEMORY

**Files:**

- Copy: `C:\Users\33667\.claude\projects\C--Users-33667\memory\*.md` → `C:\Users\33667\Vault\02-Meta\Claude\Memory\`

- [ ] **Step 1: Copier le contenu**

```bash
cp "C:/Users/33667/.claude/projects/C--Users-33667/memory/"*.md "C:/Users/33667/Vault/02-Meta/Claude/Memory/"
```

- [ ] **Step 2: Vérifier le nombre de fichiers**

```bash
ls "C:/Users/33667/Vault/02-Meta/Claude/Memory/" | wc -l
```

Expected : 16 (15 fichiers de mémoire + MEMORY.md index).

- [ ] **Step 3: Décider du mécanisme de lien**

Le système MEMORY de Claude Code est sensible au path exact. Plutôt que de risquer de casser l'auto-load :

- Garder l'original `C:\Users\33667\.claude\projects\C--Users-33667\memory\` comme **source primaire** pour Claude Code
- Le contenu vault (`Vault/02-Meta/Claude/Memory/`) est une **copie de lecture** pour navigation Obsidian
- Sync manuelle ou via un script lors d'updates significatives (à automatiser en Phase 2)

**Décision** : pas de junction côté MEMORY pour l'instant. Vault = mirror lecture seule en Phase 1. Phase 2 ajoutera la synchronisation bidirectionnelle.

- [ ] **Step 4: Ajouter une note explicative dans le vault**

Créer `C:/Users/33667/Vault/02-Meta/Claude/Memory/_README.md` :

```markdown
---
title: README Memory
type: meta-claude
tags:
  - type/meta
  - claude/memory
---

# MEMORY Claude Code

Ce dossier est un **miroir lecture** de :
`C:\Users\33667\.claude\projects\C--Users-33667\memory\`

Le système de mémoire persistante Claude Code lit la source originale.
Ce miroir permet la navigation/search/backlink Obsidian sur les souvenirs.

**Sync actuelle** : manuelle (à automatiser en Phase 2 du plan vault).
```

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/33667/Vault" && git add 02-Meta/ && git commit -m "feat(meta): migrate Claude global context and MEMORY mirror"
```

### Task 21: Test bout-en-bout Claude Code global

- [ ] **Step 1: Ouvrir un nouveau terminal**

Action utilisateur : ouvrir un terminal frais dans `C:\Users\33667\`.

- [ ] **Step 2: Lancer Claude Code et tester /context**

```bash
claude
```

Puis dans la session : `/context` (ou taper "Quel est le contexte chargé pour ce répertoire ?").

Expected : voir DeepSight, projets, MEMORY, etc.

- [ ] **Step 3: Tester un rappel de mémoire**

Demander : "Quelle est ma préférence concernant les sous-agents Opus ?"

Expected : Claude rappelle la règle Opus 4.7 partout (depuis MEMORY).

Si KO → revoir Step 3 de Task 19 (utiliser hardlink), retester.

---

## Phase F — Migration DeepSight (projet pilote)

### Task 22: Migrer le CLAUDE.md DeepSight vers `_index.md`

**Files:**

- Copy: `C:\Users\33667\DeepSight-Main\CLAUDE.md` → `C:\Users\33667\Vault\01-Projects\DeepSight\_index.md`

- [ ] **Step 1: Copier le contenu**

```bash
cp "C:/Users/33667/DeepSight-Main/CLAUDE.md" "C:/Users/33667/Vault/01-Projects/DeepSight/_index.md"
```

- [ ] **Step 2: Ajouter le frontmatter projet**

Éditer le fichier `_index.md` pour ajouter en tout début (avant la 1re ligne) :

```markdown
---
title: DeepSight
type: project-index
tags:
  - projet/deepsight
  - type/index
  - stack/fastapi
  - stack/react
  - stack/expo
  - stack/mistral
  - stack/hetzner
  - stack/vercel
updated: 2026-04-27
---
```

- [ ] **Step 3: Vérifier**

```bash
head -15 "C:/Users/33667/Vault/01-Projects/DeepSight/_index.md"
```

Expected : voir le frontmatter puis la première ligne `# DeepSight — AI Assistant Development Guide`.

### Task 23: Migrer les specs DeepSight

**Files:**

- Copy: `C:\Users\33667\DeepSight-Main\docs\superpowers\specs\*.md` → `C:\Users\33667\Vault\01-Projects\DeepSight\Specs\`

- [ ] **Step 1: Copier les specs existants**

```bash
cp "C:/Users/33667/DeepSight-Main/docs/superpowers/specs/"*.md "C:/Users/33667/Vault/01-Projects/DeepSight/Specs/"
```

- [ ] **Step 2: Vérifier**

```bash
ls "C:/Users/33667/Vault/01-Projects/DeepSight/Specs/" | wc -l
```

Expected : nombre identique au repo (au moment de la rédaction de ce plan : 7 specs récents + le présent foundation spec = 8).

- [ ] **Step 3: Ajouter le frontmatter à chaque spec**

Pour chaque fichier copié, ajouter en haut (script) :

```bash
for f in "C:/Users/33667/Vault/01-Projects/DeepSight/Specs/"*.md; do
  if ! head -1 "$f" | grep -q "^---$"; then
    name=$(basename "$f" .md)
    tmp=$(mktemp)
    {
      echo "---"
      echo "title: $name"
      echo "type: spec"
      echo "tags:"
      echo "  - projet/deepsight"
      echo "  - type/spec"
      echo "  - status/active"
      echo "---"
      echo ""
      cat "$f"
    } > "$tmp"
    mv "$tmp" "$f"
  fi
done
```

- [ ] **Step 4: Vérifier qu'au moins un fichier a le frontmatter**

```bash
head -10 "C:/Users/33667/Vault/01-Projects/DeepSight/Specs/2026-04-27-obsidian-vault-foundation-design.md"
```

Expected : frontmatter visible avec `type: spec` et `tags: projet/deepsight`.

### Task 24: Ajouter les CLAUDE-BACKEND et mobile/CLAUDE en notes liées

**Files:**

- Copy: `C:\Users\33667\DeepSight-Main\backend\CLAUDE-BACKEND.md` → `C:\Users\33667\Vault\01-Projects\DeepSight\backend-notes.md`
- Copy: `C:\Users\33667\DeepSight-Main\mobile\CLAUDE.md` → `C:\Users\33667\Vault\01-Projects\DeepSight\mobile-notes.md`

- [ ] **Step 1: Copier**

```bash
cp "C:/Users/33667/DeepSight-Main/backend/CLAUDE-BACKEND.md" "C:/Users/33667/Vault/01-Projects/DeepSight/backend-notes.md" 2>/dev/null || echo "backend CLAUDE not found - skip"
cp "C:/Users/33667/DeepSight-Main/mobile/CLAUDE.md" "C:/Users/33667/Vault/01-Projects/DeepSight/mobile-notes.md" 2>/dev/null || echo "mobile CLAUDE not found - skip"
```

- [ ] **Step 2: Lier depuis `_index.md`**

Ajouter à la fin du fichier `Vault/01-Projects/DeepSight/_index.md` :

```markdown
## Notes complémentaires

- [[backend-notes]] — Détails backend (FastAPI, models DB, déploiement)
- [[mobile-notes]] — Guide mobile Expo
```

### Task 25: Ne PAS toucher au CLAUDE.md du repo DeepSight (préserver Git)

> Décision : le repo DeepSight a un CLAUDE.md versionné Git. On NE le remplace PAS par un stub à ce stade — risque de casser le workflow Git/CI ou de polluer un éventuel collaborateur futur.
> En revanche, on synchronisera vault → repo lors d'updates manuelles, jusqu'à ce que la Phase 2 mette en place une sync automatique.

- [ ] **Step 1: Documenter cette décision dans une note de décision projet**

Créer `C:/Users/33667/Vault/01-Projects/DeepSight/Decisions/ADR-001-vault-vs-repo-claude-md.md` :

```markdown
---
title: ADR-001 — Garder CLAUDE.md dans le repo DeepSight (pas de stub vault)
type: decision
tags:
  - projet/deepsight
  - type/decision
  - status/accepted
created: 2026-04-27
---

# ADR-001 — Garder CLAUDE.md dans le repo DeepSight

**Date** : 2026-04-27
**Status** : Accepted
**Décideurs** : Maxime Leparc

## Contexte

Le vault Obsidian devient source de vérité pour la doc projet. Le repo DeepSight versionne `CLAUDE.md` via Git, ce qui apporte historique, peer review possible, et compatibilité avec d'autres outils (`gh`, CI/CD).

## Décision

Le `_index.md` du vault est la **version travail** (édition fluide en Obsidian). Le `CLAUDE.md` du repo reste **versionné Git** et est mis à jour manuellement par un copier-coller depuis le vault au moment des commits documentaires.

## Conséquences

### Positives

- Pas de risque de casser le workflow CI/CD du repo
- Git history préservé sur la doc projet
- Pas de symlink/junction fragile à maintenir

### Négatives

- Maxime doit penser à propager les modifs vault → repo manuellement
- Risque de drift temporaire entre les deux versions

### Neutres

- La Phase 2 du projet vault automatisera cette sync via un sous-agent Claude

## Alternatives considérées

### Junction de fichier

**Pour** : sync automatique
**Contre** : casse le contrôle Git (le fichier vu par Git est en réalité une junction qui résout ailleurs ; comportement imprévisible selon la commande)

### Stub avec import @path

**Pour** : pas de duplication
**Contre** : si Claude Code n'auto-suit pas l'import dans tous les contextes (Cowork, Desktop, ...), le contexte projet est perdu

## Références

- Spec : `2026-04-27-obsidian-vault-foundation-design.md`
- Plan : `2026-04-27-obsidian-vault-foundation.md` (ce plan)
```

- [ ] **Step 2: Commit**

```bash
cd "C:/Users/33667/Vault" && git add 01-Projects/DeepSight/ && git commit -m "feat(deepsight): migrate _index, specs, backend/mobile notes, ADR-001"
```

### Task 26: Test ouverture Obsidian + navigation DeepSight

- [ ] **Step 1: Lancer Obsidian sur le vault**

Action utilisateur : Obsidian → ouvrir le vault `C:\Users\33667\Vault\`.

- [ ] **Step 2: Naviguer vers DeepSight**

Cliquer sur `01-Projects/DeepSight/_index.md`. Vérifier que le contenu s'affiche, que le frontmatter est rendu correctement, que les liens `[[backend-notes]]` et `[[mobile-notes]]` sont cliquables.

- [ ] **Step 3: Tester search global**

Lancer une recherche (Ctrl+Shift+F) sur "Mistral". Vérifier que les résultats incluent au moins :

- `_index.md` (mention dans la stack)
- Au moins un spec dans `Specs/`
- `02-Meta/Claude/global.md` (mention modèles Mistral)

Si ça remonte plusieurs fichiers de plusieurs zones du vault → la cross-projet/meta search fonctionne.

- [ ] **Step 4: Tester le graph view**

Cmd/Ctrl+G → vérifier que le graph affiche les notes DeepSight reliées entre elles via les `[[wikilinks]]` et tags `#projet/deepsight`.

---

## Phase G — Validation finale Phase 1

### Task 27: Checklist des critères de succès

> Reprend la section §5 du spec et valide chaque point.

- [ ] **Step 1: Vault au bon path et synchronisé**

```bash
ls "C:/Users/33667/Vault/" && echo "---"
```

Expected : structure de dossiers visible. Côté Obsidian Sync : Settings → Sync → status "Synced" ou "Connected".

- [ ] **Step 2: Structure complète**

```bash
find "C:/Users/33667/Vault" -type d -not -path "*/.obsidian*" -not -path "*/.git*" | sort
```

Expected : exactement les dossiers du spec §4.3.

- [ ] **Step 3: Plugins installés**

Action utilisateur : Settings → Community plugins → Installed → vérifier la présence de :

- Templater (Enabled)
- Dataview (Enabled)
- Obsidian Git (Enabled)
- Tag Wrangler (Enabled)
- Auto Note Mover (Enabled)

- [ ] **Step 4: 6 templates en place**

```bash
ls "C:/Users/33667/Vault/Templates/" | sort
```

Expected output exact :

```
_index.md
bug.md
decision.md
idea.md
session.md
spec.md
```

- [ ] **Step 5: DeepSight migré**

```bash
ls "C:/Users/33667/Vault/01-Projects/DeepSight/"
ls "C:/Users/33667/Vault/01-Projects/DeepSight/Specs/" | head
```

Expected : `_index.md`, `Specs/` avec ≥7 fichiers, `Decisions/` avec ADR-001, dossiers `Bugs/Ideas/Sessions/` (vides au début).

- [ ] **Step 6: Claude global et MEMORY**

```bash
ls "C:/Users/33667/Vault/02-Meta/Claude/" "C:/Users/33667/Vault/02-Meta/Claude/Memory/" | head -20
```

Expected : `global.md` présent + `Memory/` contient les ~15 fichiers + `_README.md` + `MEMORY.md`.

- [ ] **Step 7: Claude Code charge le contexte global**

Action utilisateur : ouvrir Claude Code dans `C:\Users\33667\` puis dans `C:\Users\33667\DeepSight-Main\`. Dans chaque cas, taper `/context` ou demander "résume ce que tu sais sur ce projet" — le contexte attendu doit s'afficher.

- [ ] **Step 8: Search cross-projet fonctionnelle (Obsidian)**

Cf. Task 26 Step 3.

- [ ] **Step 9: Au moins 3 projets supplémentaires migrés (Phase H)**

Voir Task 28+ ci-dessous.

### Task 28: Commiter le plan d'implémentation dans le repo DeepSight

**Files:**

- Add: `docs/superpowers/specs/2026-04-27-obsidian-vault-foundation-design.md` (déjà existant)
- Add: `docs/superpowers/plans/2026-04-27-obsidian-vault-foundation.md` (ce fichier)

- [ ] **Step 1: Vérifier le statut git**

```bash
cd "C:/Users/33667/DeepSight-Main" && git status docs/superpowers/
```

Expected : voir les 2 fichiers en untracked.

- [ ] **Step 2: Commit**

```bash
cd "C:/Users/33667/DeepSight-Main" && git add docs/superpowers/specs/2026-04-27-obsidian-vault-foundation-design.md docs/superpowers/plans/2026-04-27-obsidian-vault-foundation.md && git commit -m "$(cat <<'EOF'
docs(specs): add Obsidian vault foundation Phase 1 spec + plan

Spec : architecture du vault Obsidian comme source de vérité unique
pour DeepSight et les autres projets de code.

Plan : 28+ tasks d'implémentation couvrant déplacement vault,
structure de dossiers, plugins, templates, migration Claude
global + DeepSight pilote.

Phase 2 (intégration bidir Claude, agent sync, MCP custom)
traitée dans un spec séparé.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected : `2 files changed, ~XYZ insertions(+)`.

---

## Phase H — Migration des autres projets (process repeatable)

> À répéter pour chaque projet (Grassmotion, Dug-Bot, lalanation-miniapp, vmod-mcp, autres `_projets/`). Chaque itération suit le même pattern qu'en Phase F.

### Task 29: Définir la liste des projets à migrer

- [ ] **Step 1: Lister les projets candidats**

```bash
ls "C:/Users/33667/" | grep -v -E "^(\\.|AppData|Documents|Pictures|Desktop|Downloads|Music|Videos|Vault|3D Objects|Contacts|Favorites|Links|OneDrive|Saved Games|Searches|Local Settings|My Documents|Recent|Application Data|NTUSER|ntuser)" 2>/dev/null
ls "C:/Users/33667/_projets/" 2>/dev/null
ls "C:/Users/33667/Documents/GitHub/" 2>/dev/null
```

- [ ] **Step 2: Documenter les paths canoniques dans une note**

Créer `C:/Users/33667/Vault/02-Meta/Conventions/projects-paths.md` listant tous les projets avec leur path local et leur statut (actif / archive).

### Task 30: Migration template (à répéter par projet)

Pour chaque projet `<Projet>` :

- [ ] **Step 1: Créer la sous-structure**

```bash
PROJECT="Grassmotion"  # changer selon le projet
mkdir -p "C:/Users/33667/Vault/01-Projects/${PROJECT}/Specs" \
         "C:/Users/33667/Vault/01-Projects/${PROJECT}/Decisions" \
         "C:/Users/33667/Vault/01-Projects/${PROJECT}/Bugs" \
         "C:/Users/33667/Vault/01-Projects/${PROJECT}/Ideas" \
         "C:/Users/33667/Vault/01-Projects/${PROJECT}/Sessions"
```

- [ ] **Step 2: Migrer le CLAUDE.md s'il existe**

```bash
PROJECT_PATH="C:/Users/33667/Documents/GitHub/grassmotion-miniapp"  # adapter
PROJECT_NAME="Grassmotion"
if [ -f "$PROJECT_PATH/CLAUDE.md" ]; then
  cp "$PROJECT_PATH/CLAUDE.md" "C:/Users/33667/Vault/01-Projects/${PROJECT_NAME}/_index.md"
  echo "✓ Migrated $PROJECT_NAME"
else
  # Créer un _index.md minimaliste à partir du template
  echo "No CLAUDE.md found, will use template"
fi
```

- [ ] **Step 3: Ajouter le frontmatter**

(Comme Task 22 Step 2, adapter les tags `stack/...`)

- [ ] **Step 4: Migrer les specs s'il y en a**

```bash
if [ -d "$PROJECT_PATH/docs/superpowers/specs" ]; then
  cp "$PROJECT_PATH/docs/superpowers/specs/"*.md "C:/Users/33667/Vault/01-Projects/${PROJECT_NAME}/Specs/" 2>/dev/null
fi
```

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/33667/Vault" && git add "01-Projects/${PROJECT_NAME}/" && git commit -m "feat(${PROJECT_NAME}): migrate _index and specs"
```

### Task 31: Migrer Grassmotion, Dug-Bot, lalanation-miniapp, vmod-mcp

Appliquer Task 30 aux 4 projets, dans cet ordre (par fréquence d'usage récente).

| Projet             | Path                                                  | Source de CLAUDE.md  |
| ------------------ | ----------------------------------------------------- | -------------------- |
| Grassmotion        | `C:\Users\33667\Documents\GitHub\grassmotion-miniapp` | Vérifier `CLAUDE.md` |
| Dug-Bot            | `C:\Users\33667\_projets\lalanation\Dug-Bot`          | Vérifier `CLAUDE.md` |
| lalanation-miniapp | `C:\Users\33667\_projets\lalanation-miniapp`          | Vérifier `CLAUDE.md` |
| vmod-mcp           | `C:\Users\33667\vmod-mcp`                             | Vérifier `CLAUDE.md` |

- [ ] **Step 1: Pour chaque projet ci-dessus, exécuter Task 30**

Ne pas oublier d'adapter `PROJECT`, `PROJECT_PATH`, et les tags stack.

- [ ] **Step 2: Vérifier le résultat global**

```bash
ls "C:/Users/33667/Vault/01-Projects/" | sort
```

Expected : voir DeepSight, Grassmotion, Dug-Bot, lalanation-miniapp, vmod-mcp.

### Task 32: Validation finale cross-projet

- [ ] **Step 1: Search Obsidian sur "Telegram"**

Action utilisateur : Ctrl+Shift+F → "Telegram". Devrait remonter des fichiers depuis Dug-Bot, lalanation-miniapp, et Grassmotion.

- [ ] **Step 2: Filtrer par tag `#stack/nextjs`**

Action utilisateur : ouvrir le panneau de tags → cliquer `#stack/nextjs`. Devrait afficher les fichiers de tous les projets utilisant Next.js.

- [ ] **Step 3: Tester Dataview cross-projet**

Créer une note temporaire `00-Inbox/test-dataview.md` :

````markdown
# Test Dataview

```dataview
TABLE type, file.folder
FROM #type/spec
SORT file.mtime DESC
LIMIT 10
```
````

Vérifier que les 10 specs les plus récents (tous projets confondus) s'affichent.

- [ ] **Step 4: Commit final Phase 1**

```bash
cd "C:/Users/33667/Vault" && git add . && git commit -m "feat(vault): Phase 1 complete — all projects migrated, cross-project search validated"
```

---

## Sortie Phase 1 → Phase 2

À ce stade :

✅ Vault Obsidian fondateur en place
✅ Structure standardisée tous projets
✅ Plugins installés et configurés
✅ 6 templates utilisables
✅ Migration Claude global + DeepSight pilote + 4 projets supplémentaires
✅ Critères de succès du spec §5 atteints

**Prochain cycle** (spec Phase 2 séparé) :

- Sous-agent `obsidian-sync` pour Claude Code
- Slash commands `/note`, `/archive-conversation`, `/new-spec`
- Exploitation de l'Obsidian CLI activée
- Synchronisation auto MEMORY ↔ vault
- Workflow capture conversationnelle
- MCP Obsidian pour Claude.ai (web)
