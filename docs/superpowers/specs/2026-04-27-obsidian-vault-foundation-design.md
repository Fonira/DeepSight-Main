# Obsidian Vault Foundation — Phase 1

**Date** : 2026-04-27
**Auteur** : Maxime Leparc (Arinov)
**Status** : Draft — en attente review utilisateur
**Périmètre** : Phase 1 d'un projet en 2 phases. Phase 2 (intégration Claude bidirectionnelle, agent sync, MCP custom) traitée dans un spec séparé.

---

## 1. Contexte & motivation

L'utilisateur (solo founder Arinov, projet principal DeepSight) a actuellement son contenu Claude éparpillé sur disque :

- `C:\Users\33667\CLAUDE.md` — contexte global Claude Code
- `C:\Users\33667\.claude\projects\C--Users-33667\memory\*.md` — système de mémoire persistante (~14 fichiers)
- `C:\Users\33667\DeepSight-Main\CLAUDE.md` — contexte projet
- `C:\Users\33667\DeepSight-Main\backend\CLAUDE-BACKEND.md`
- `C:\Users\33667\DeepSight-Main\mobile\CLAUDE.md`
- `C:\Users\33667\DeepSight-Main\docs\superpowers\specs\*.md` — specs brainstorming (~7 specs actifs)
- Idem pour les autres projets : Grassmotion, Dug-Bot, lalanation-miniapp, vmod-mcp...

Conséquences :

- Pas de search global, pas de backlinks entre projets
- Pas de capture rapide d'idées cross-projet
- Pas de second cerveau navigable hors session Claude
- Quand l'utilisateur ouvre Claude.ai (web), aucun contexte n'est disponible

L'utilisateur a souscrit à **Obsidian Sync Plus** (10 vaults, 10 Go, multi-device) et veut centraliser **toutes ses infos DeepSight + autres projets de code** dans un vault unique, utilisé comme cerveau dev principal.

## 2. Objectifs (in scope)

1. **Un vault Obsidian unique** servant de source de vérité pour DeepSight et tous les projets de code de l'utilisateur
2. **Une architecture de dossiers standardisée** par projet (specs, decisions, bugs, ideas, sessions)
3. **Une convention de nommage et un système de tags** uniformes
4. **Des templates Obsidian** pour les types de notes récurrents
5. **Une liste de plugins essentiels** installés et configurés
6. **Un plan de migration** du contenu existant (CLAUDE.md, MEMORY, specs) vers le vault, avec préservation de l'auto-load Claude Code dans les repos

## 3. Hors périmètre (Phase 2)

- Intégration bidirectionnelle Claude ↔ vault (sous-agent Obsidian, slash commands custom, MCP server dédié)
- Sync auto entre projets de code et notes vault déclenchée par événements Git
- Workflow de capture conversationnelle ("archiver cette conversation Claude dans le vault")
- Daily notes systématiques (à activer plus tard si besoin)
- Plugins productivité (Calendar, Kanban, Excalidraw, Smart Connections IA)

## 4. Décisions architecturales

### 4.1. Type de vault

**Vault unique "Pro"** contenant tous les projets de code.
Justification : projets fortement liés en stack (Telegram bots, TS/Next.js, Vercel, Hetzner, Mistral) et en process Claude (MCP, MEMORY, superpowers). Backlinks cross-projets attendus. Search global plus puissant. 10-vault cap Sync non saturé.

Un éventuel second vault perso pourra être ajouté plus tard sans impacter celui-ci.

### 4.2. Path du vault sur disque

**`C:\Users\33667\Vault\`**

- ASCII pur, court, à la racine du home directory
- Évite `Documents/` (chemin long, espaces, sync OneDrive parasites)
- Obsidian Sync gère la propagation multi-device indépendamment du path local

### 4.3. Structure des dossiers

```
Vault/
├── 00-Inbox/                     # capture rapide, à trier/archiver dans la semaine
├── 01-Projects/                  # projets actifs
│   └── <Projet>/                 # ex: DeepSight, Grassmotion, vmod-mcp...
│       ├── _index.md             # vue d'ensemble du projet (= ancien CLAUDE.md projet)
│       ├── Specs/                # specs features (= ancien docs/superpowers/specs/)
│       ├── Decisions/            # ADRs, choix techniques
│       ├── Bugs/                 # bugs/incidents documentés
│       ├── Ideas/                # roadmap, idées features
│       └── Sessions/             # journal des sessions de code
├── 02-Meta/                      # transversal à tous les projets
│   ├── Claude/                   # MEMORY, préférences, configs MCP
│   │   ├── global.md             # ancien C:\Users\33667\CLAUDE.md
│   │   └── Memory/               # contenu de .claude/projects/.../memory/
│   ├── Patterns/                 # patterns réutilisables (Telegram bot, Vercel deploy...)
│   ├── Stack/                    # notes par techno (Next.js, Mistral, Hetzner...)
│   └── Conventions/              # conventions perso (commits, naming...)
├── 03-Archive/                   # projets terminés ou abandonnés
└── Templates/                    # templates Obsidian (configurés pour être ignorés du graph)
```

Sous-dossiers projet **standardisés** : ouvrir n'importe quel projet, savoir immédiatement où chaque chose se trouve.

### 4.4. Source de vérité

**Le vault est la source de vérité unique.** Le contenu existant migre vers le vault. Les fichiers attendus dans les repos projet (`CLAUDE.md`, `docs/superpowers/specs/`) sont **regénérés** depuis le vault par l'un de ces mécanismes (à choisir lors de l'implémentation, voir §6) :

- **Junction Windows** (`mklink /J`) — symlink natif vers le dossier vault, ne nécessite pas de mode admin
- **Hardlink** (`mklink /H`) — fichier unique avec deux paths sur le même volume
- **Import Markdown Claude Code** (`@C:/Users/33667/Vault/...`) — une ligne dans le CLAUDE.md du repo qui référence le fichier vault

L'option exacte sera tranchée projet par projet à l'implémentation, en privilégiant la junction de dossier quand c'est possible (un seul lien à maintenir au lieu de N hardlinks).

### 4.5. Conventions de nommage

| Type de note          | Convention                                                            | Exemple                                      |
| --------------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| Vue d'ensemble projet | `_index.md` à la racine du dossier projet                             | `01-Projects/DeepSight/_index.md`            |
| Spec                  | `YYYY-MM-DD-<topic>-design.md` _(matche format superpowers existant)_ | `2026-04-26-quick-voice-call-design.md`      |
| Décision (ADR)        | `ADR-NNN-<topic>.md` numérotation séquentielle par projet             | `ADR-007-mistral-vs-openai.md`               |
| Bug                   | `<YYYY-MM-DD>-<slug>.md`                                              | `2026-04-25-shadow-dom-white-widget.md`      |
| Session               | `YYYY-MM-DD-<topic>.md` dans `Sessions/`                              | `2026-04-27-grassmotion-admin-fix.md`        |
| Idée                  | `<slug>.md` libre                                                     | `voice-tts-elevenlabs.md`                    |
| Note Meta             | `<slug>.md` libre                                                     | `02-Meta/Patterns/telegram-webhook-setup.md` |

Règles transversales :

- **kebab-case** dans tous les filenames (pas de `camelCase`, pas d'`under_score`)
- **Pas d'accents** dans les filenames (compatibilité multi-OS, search shell)
- **Dates ISO 8601** (`YYYY-MM-DD`) en préfixe quand pertinent
- **Titres de notes** : libre dans le frontmatter `title:`, accents autorisés

### 4.6. Système de tags

Taxonomie hiérarchique à 3 axes principaux + 1 optionnel :

- **`#projet/<nom>`** — `#projet/deepsight`, `#projet/grassmotion`, `#projet/vmod-mcp`...
- **`#type/<type>`** — `#type/spec`, `#type/decision`, `#type/bug`, `#type/idea`, `#type/session`, `#type/pattern`
- **`#stack/<techno>`** — `#stack/nextjs`, `#stack/mistral`, `#stack/hetzner`, `#stack/expo`, `#stack/vercel`, `#stack/postgres`...
- **`#status/<état>`** _(optionnel, sur idées/bugs/sessions)_ — `#status/open`, `#status/in-progress`, `#status/done`, `#status/blocked`, `#status/wontfix`

Permet à Dataview de générer des vues croisées :

- Toutes les decisions Hetzner cross-projets : `TAG:#stack/hetzner AND TAG:#type/decision`
- Tous les bugs ouverts : `TAG:#type/bug AND TAG:#status/open`
- Toutes les ideas DeepSight : `TAG:#projet/deepsight AND TAG:#type/idea`

### 4.7. Plugins Obsidian essentiels

Installer dès le début :

| Plugin              | Rôle                                                                          |
| ------------------- | ----------------------------------------------------------------------------- |
| **Templater**       | Templates dynamiques (date auto, prompts utilisateur, snippets paramétrables) |
| **Dataview**        | Requêtes sur les notes — vues croisées via tags/folders/frontmatter           |
| **Obsidian Git**    | Versionne le vault localement (filet de sécurité au-delà de Sync)             |
| **Tag Wrangler**    | Renommer/fusionner des tags proprement quand la taxonomie évolue              |
| **Auto Note Mover** | Auto-classe les notes depuis `00-Inbox/` selon des règles (tag → dossier)     |

Reportés à plus tard (Phase 2 ou usage avéré) :

- Calendar (si daily notes activés)
- Kanban (gestion bugs/ideas en colonnes)
- Excalidraw (schémas)
- Smart Connections (recherche sémantique IA)

### 4.8. Templates à créer

Tous dans `Templates/`. Configurer Templater pour pointer vers ce dossier. Les notes du dossier `Templates/` doivent être exclues de la search globale et du graph (option Obsidian native).

| Template      | Sections principales                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `_index.md`   | Stack technique, URLs prod/staging, status global, quotas/limites, liens vers Specs/Decisions clés, contacts/comptes |
| `spec.md`     | Clone du format superpowers actuel : Contexte, Objectifs, Hors périmètre, Décisions, Plan, Success criteria          |
| `decision.md` | Format ADR : Contexte, Décision, Conséquences, Alternatives considérées, Date                                        |
| `bug.md`      | Symptôme, Repro steps, Root cause, Fix, Prevention, Date                                                             |
| `session.md`  | Date, Goal, Done, Blockers, Next steps, Notes brutes                                                                 |
| `idea.md`     | Format minimaliste : titre, problème adressé, esquisse de solution, statut                                           |

### 4.9. Migration plan

Ordre d'exécution (détails opérationnels dans le plan d'implémentation) :

1. **Setup vault**
   - Renommer/déplacer le vault Obsidian existant ("Obsidian Vault" par défaut) vers `C:\Users\33667\Vault\`
   - Créer la structure de dossiers (§4.3)
   - Installer les 5 plugins (§4.7), configurer Templater pour pointer vers `Templates/`

2. **Créer les 6 templates** (§4.8) dans `Templates/`

3. **Migrer le contenu Claude global**
   - `C:\Users\33667\CLAUDE.md` → `Vault/02-Meta/Claude/global.md`
   - `C:\Users\33667\.claude\projects\C--Users-33667\memory\*.md` → `Vault/02-Meta/Claude/Memory/`
   - Recréer le lien (junction ou import) vers les paths d'origine pour préserver l'auto-load Claude Code

4. **Migrer DeepSight (projet pilote)**
   - `DeepSight-Main/CLAUDE.md` → `Vault/01-Projects/DeepSight/_index.md`
   - `DeepSight-Main/docs/superpowers/specs/*.md` → `Vault/01-Projects/DeepSight/Specs/`
   - `DeepSight-Main/backend/CLAUDE-BACKEND.md` et `DeepSight-Main/mobile/CLAUDE.md` → notes complémentaires liées depuis `_index.md`
   - Recréer les liens vers les paths d'origine
   - **Test** : ouvrir Claude Code dans `DeepSight-Main`, vérifier que `/context` charge le contexte attendu

5. **Itérer projet par projet** (ordre suggéré, par fréquence d'usage récente)
   - Grassmotion (`C:\Users\33667\Documents\GitHub\grassmotion-miniapp`)
   - Dug-Bot (`C:\Users\33667\_projets\lalanation\Dug-Bot`)
   - lalanation-miniapp (`C:\Users\33667\_projets\lalanation-miniapp`)
   - vmod-mcp (`C:\Users\33667\vmod-mcp`)
   - Autres projets `_projets/` au fur et à mesure

6. **Validation finale**
   - Tous les projets accessibles depuis Obsidian avec structure standard
   - Tous les `CLAUDE.md` projet continuent de se charger via Claude Code (junctions/imports OK)
   - `MEMORY.md` index lisible depuis Obsidian, mémoire persistante Claude Code intacte
   - Search Obsidian fonctionnelle sur l'ensemble du contenu

## 5. Critères de succès

La Phase 1 est réussie quand **tous** les points suivants sont vrais :

- [ ] Le vault est à `C:\Users\33667\Vault\` et synchronisé sur tous les devices via Obsidian Sync
- [ ] La structure de dossiers (§4.3) est créée intégralement
- [ ] Les 5 plugins (§4.7) sont installés et configurés
- [ ] Les 6 templates (§4.8) existent dans `Templates/`
- [ ] DeepSight est migré : `_index.md`, `Specs/`, autres notes en place
- [ ] `MEMORY.md` global et `global.md` Claude sont dans `02-Meta/Claude/`
- [ ] Claude Code dans `DeepSight-Main` charge le contexte attendu (auto-load fonctionne)
- [ ] Au moins 3 projets supplémentaires (Grassmotion, Dug-Bot, vmod-mcp) sont migrés selon la même méthode
- [ ] Une recherche Obsidian sur "Mistral" remonte des notes de plusieurs projets (preuve que le cross-projet fonctionne)

## 6. Questions ouvertes (à résoudre lors du writing-plans)

1. **Mécanisme de lien vault ↔ repos** : junction de dossier vs hardlink fichier vs import Markdown — décider projet par projet selon ce qui s'intègre le mieux à la structure existante du repo
2. **Sort de `.claude/projects/.../memory/`** : on déplace tout le dossier sous une junction, ou on garde l'original et on synchronise vers le vault ? Impact sur l'auto-loading de la mémoire Claude Code à investiguer
3. **Specs en cours** dans DeepSight-Main : les 7 specs récents (`2026-04-25-elevenlabs-...`, etc.) sont-ils tous à migrer, ou certains sont obsolètes/à archiver dans `03-Archive/` ?
4. **Sous-dossier `_projets/`** : certains projets ont des CLAUDE.md, d'autres pas — à quel niveau de granularité importer (tous ? seulement les actifs ?)

## 7. Aperçu Phase 2 (pour mémoire — pas dans ce spec)

Une fois la fondation stable, Phase 2 ajoutera :

- **Sous-agent Claude Code `obsidian-sync`** (`.claude/agents/obsidian-sync.md`) — pour archiver une conversation, créer un spec, mettre à jour `_index.md` depuis Claude
- **Slash commands custom** : `/note`, `/archive-conversation`, `/new-spec`, `/sync-vault`
- **Exploitation de l'Obsidian CLI** récemment activée par l'utilisateur — driver Obsidian depuis Claude Code via `obsidian://` ou la commande shell
- **MCP Obsidian** custom (si nécessaire) pour accès unifié depuis Claude.ai (web), Claude Desktop et Claude Code
- **Workflow capture conversationnelle** : raccourci pour transformer une conversation Claude en note structurée dans le vault
