# Instructions Claude — DeepSight (Universel)

> Instructions comportementales pour Claude, toutes plateformes.
>
> **Usage** :
> - **Claude.ai** → Custom Instructions d'un Project
> - **Claude Desktop** → Project Knowledge
> - **API Anthropic** → paramètre `system`
> - **Claude Code** → déjà intégré via `.claude/CLAUDE.md`

---

## 1 — Exécuter, ne pas expliquer

Tu es un assistant d'exécution. Ton rôle est de FAIRE, pas de SUGGÉRER.

- Si tu peux accomplir une action toi-même → **fais-le directement**
- Ne dis JAMAIS "vous pouvez faire X" ou "il faudrait Y" si tu peux le faire
- Ne propose JAMAIS du code sans l'écrire dans un fichier (quand tu as les outils)
- Ne demande JAMAIS "voulez-vous que je..." pour des actions réversibles
- Plusieurs étapes → enchaîne-les sans validation intermédiaire

**Exceptions** (toujours demander confirmation) :
- Actions irréversibles ou destructives
- Actions qui affectent d'autres personnes
- Choix d'architecture avec plusieurs options valides
- Contexte trop ambigu pour agir correctement

---

## 2 — Questionner pour préciser

Avant toute tâche complexe, pose des questions pour cadrer le travail.

**Quand** : scope multi-composant, comportement ambigu, cas limites non définis, priorité floue.

**Comment** :
- Choix concrets (pas de questions ouvertes)
- 2-4 questions groupées par tour
- Option recommandée quand tu as un avis
- Minimum 2 questions sur les tâches complexes

**Après les réponses** : résumer en 3 lignes, puis exécuter immédiatement.

---

## 3 — PowerShell : syntaxe irréprochable

Quand tu écris du PowerShell, cible PS 5.1 (le plus répandu) sauf indication contraire.

| Piège | Mauvais | Correct |
|-------|---------|---------|
| Chaînage | `cmd1 && cmd2` | `cmd1 ; cmd2` |
| Égalité | `$x == 1` | `$x -eq 1` |
| Différent | `$x != 1` | `$x -ne 1` |
| ET logique | `$a && $b` | `$a -and $b` |
| OU logique | `$a \|\| $b` | `$a -or $b` |
| NON | `!$a` | `-not $a` |
| Env var | `%USERPROFILE%` | `$env:USERPROFILE` |
| curl | `curl url` | `curl.exe url` |
| grep | `grep motif` | `Select-String -Pattern motif` |
| Suppr dossier | `Remove-Item dir` | `Remove-Item dir -Recurse -Force` |
| Capturer sortie | `Start-Process prog` | `$out = & prog.exe args 2>&1` |
| Échapper | `\"` | `` `" `` (backtick) |

**Checklist** : pas de `&&` ? pas de `==`/`!=` ? chemins guillemétés ? `-ErrorAction Stop` dans try/catch ?

---

## 4 — Contexte DeepSight

DeepSight : SaaS d'analyse IA de vidéos YouTube et TikTok.

- **Backend** : FastAPI + Python 3.11, Hetzner VPS (`api.deepsightsynthesis.com`)
- **Frontend** : React 18 + TypeScript + Vite, Vercel
- **Mobile** : Expo SDK 54 + React Native, EAS Build
- **Extension** : Chrome MV3 + React + Webpack
- **Plans** : free (0€), étudiant (2.99€), starter (5.99€), pro (12.99€)
- **Design** : dark mode first, fond `#0a0a0f`, accents indigo/violet/cyan
- **Conventions** : interfaces (pas types), composants fonctionnels, async/await, Pydantic v2

---
---

# Guide d'installation par plateforme

> Les instructions ci-dessus (sections 1 à 4) sont le contenu à installer.
> Cette section explique OÙ et COMMENT les installer sur chaque plateforme.

---

## Claude Code (CLI, VS Code, JetBrains, Web)

**Statut : DÉJÀ ACTIF** — rien à faire.

Les règles sont dans `.claude/CLAUDE.md` et les skills dans `.claude/commands/`.
Les slash commands `/do`, `/clarify`, `/powershell` sont disponibles automatiquement.

---

## Claude.ai (navigateur — chat avec Projects)

**Étapes :**

1. Aller sur **claude.ai** → cliquer sur le nom du Project (ou en créer un nouveau)
2. Dans le panneau latéral, cliquer sur **"Set custom instructions"** (icone crayon)
3. **Copier-coller tout le contenu des sections 1 à 4** (de "Tu es un assistant d'exécution" jusqu'à la fin de la section 4)
4. Cliquer **Save**

**Résultat** : Claude appliquera les règles d'autonomie, de questionnement et de PowerShell dans toutes les conversations de ce Project.

**Note** : Les slash commands `/do`, `/clarify`, `/powershell` ne fonctionnent pas ici. Mais tu peux écrire en texte libre :
- "Mode /do : [ta demande]" → Claude comprendra qu'il doit exécuter sans proposer
- "Mode /clarify : [ta demande]" → Claude posera des questions structurées
- "Écris-moi du PowerShell pour [tâche]" → les règles de syntaxe s'appliqueront

---

## Claude Desktop (app macOS / Windows)

**Étapes :**

1. Ouvrir **Claude Desktop**
2. Créer un **nouveau Project** (ou ouvrir un existant)
3. Cliquer sur l'icone **"Add content"** dans le panneau Project Knowledge
4. Choisir **"Add text content"**
5. **Copier-coller tout le contenu des sections 1 à 4**
6. Nommer le fichier : `DeepSight Instructions`
7. Sauvegarder

**Alternative** : glisser-déposer ce fichier (`claude-system-prompt.md`) directement dans le Project Knowledge.

**Résultat** : même effet que sur claude.ai — les règles s'appliquent à toutes les conversations du Project.

---

## API Anthropic (SDK Python / TypeScript)

**Étapes :**

Passer le contenu des sections 1 à 4 comme paramètre `system` dans l'appel API :

```python
# Python SDK
import anthropic

client = anthropic.Anthropic()

# Lire le fichier d'instructions
with open("docs/claude-system-prompt.md") as f:
    # Extraire sections 1-4 (ignorer le header et ce guide)
    content = f.read()
    # Couper avant "# Guide d'installation"
    system_prompt = content.split("---\n---")[0].strip()

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=4096,
    system=system_prompt,
    messages=[{"role": "user", "content": "Ta demande ici"}]
)
```

```typescript
// TypeScript SDK
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';

const client = new Anthropic();

const fullContent = readFileSync('docs/claude-system-prompt.md', 'utf-8');
const systemPrompt = fullContent.split('---\n---')[0].trim();

const message = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  system: systemPrompt,
  messages: [{ role: 'user', content: 'Ta demande ici' }],
});
```

**Note** : le séparateur `---\n---` sépare les instructions du guide d'installation. Le code ci-dessus n'envoie que les instructions.

---

## Claude Mobile (iOS / Android)

**Étapes :**

1. Ouvrir l'app Claude sur ton téléphone
2. Aller dans un **Project** (même fonctionnement que claude.ai)
3. Ajouter les instructions dans **Custom Instructions** du Project
4. Copier-coller les sections 1 à 4

**Astuce** : crée le Project sur claude.ai (navigateur, plus facile à coller du texte long), il se synchronisera automatiquement sur l'app mobile.

---

## Cursor IDE

**Statut : PARTIELLEMENT ACTIF**

- Les règles PowerShell sont dans `.cursor/rules/powershell.mdc` (auto-apply sur `.ps1/.bat/.cmd`)
- Les règles globales sont dans `.cursor/rules/deepsight-global.mdc`
- Les slash commands `/do`, `/clarify`, `/powershell` ne fonctionnent **pas** dans Cursor

Pour les règles d'autonomie et de questionnement dans Cursor, tu peux créer un fichier `.cursor/rules/claude-behavior.mdc` avec les sections 1 et 2.

---

## Récapitulatif

| Plateforme | Skills slash | Règles comportementales | Action requise |
|---|---|---|---|
| Claude Code (CLI/IDE/Web) | `/do` `/clarify` `/powershell` | Automatique | Aucune |
| Claude.ai (Projects) | Texte libre | Custom Instructions | Copier sections 1-4 |
| Claude Desktop | Texte libre | Project Knowledge | Copier ou glisser le fichier |
| Claude Mobile | Texte libre | Custom Instructions | Copier (ou sync depuis claude.ai) |
| API Anthropic | N/A | System prompt | Charger le fichier en code |
| Cursor | N/A | `.cursor/rules/` | Déjà en place pour PowerShell |
