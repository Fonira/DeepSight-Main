# Skills & Plugins Claude Code — Recommandations DeepSight

_Mars 2026 — Classés par impact pour ton stack_

---

## 🏆 TIER S — Installation immédiate (Impact max pour DeepSight)

### 1. Superpowers (obra/superpowers) — ⭐ 27.9K

**Le framework le plus populaire de l'écosystème.**

- Brainstorm structuré → Plan → Exécution avec checkpoints
- TDD red-green-refactor intégré
- Debugging systématique en 4 phases
- Sub-agent driven development avec code review

**Installation :**

```bash
# Dans Claude Code CLI
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

**Pourquoi pour DeepSight :** Impose une discipline plan → execute → review qui colle parfaitement à ton workflow Notion. Évite les dérives de scope.

---

### 2. Callstack React Native Agent Skills — ⭐ 12K+

**Skills officiels Callstack + Expo pour React Native.**

- Best practices RN/Expo maintenues par les créateurs de Callstack
- Patterns de performance, accessibilité, architecture
- Compatible Expo SDK 52-54+, New Architecture (Fabric/TurboModules)

**Installation :**

```bash
/plugin marketplace add callstackincubator/agent-skills
/plugin install react-native-best-practices@callstack-agent-skills
```

**Pourquoi pour DeepSight :** Ton app mobile Expo SDK 54 bénéficie directement des patterns officiels. Évite les anti-patterns RN classiques.

---

### 3. Expo Official Skills

**Skills officiels publiés par l'équipe Expo.**

- Build, deploy, debug Expo apps
- EAS Build/Submit workflows
- Navigation, auth, storage patterns

**Documentation :** https://docs.expo.dev/skills/

**Pourquoi pour DeepSight :** Directement applicable à ton workflow EAS Build/Submit iOS + Android.

---

### 4. Code Review Plugin (Anthropic officiel)

**Review de code multi-agent parallèle.**

- 5 agents en parallèle analysent tes diffs
- Ne flag que les issues scorées 80+
- Fonctionne sur git diffs locaux

**Installation :**

```bash
/plugin install code-review
```

**Pourquoi pour DeepSight :** Solo dev = pas de pair review. Ce plugin compense en analysant chaque commit avant push.

---

## 🥇 TIER A — Forte valeur ajoutée

### 5. Vercel React Best Practices — 176K installs

**Le skill le plus installé après find-skills.**

- Patterns React 18+ officiels Vercel
- Optimisation build Vite/Next.js
- Server components, data fetching patterns

**Installation :**

```bash
npx add-skill vercel-react-best-practices
```

**Pourquoi pour DeepSight :** Frontend React 18 + Vite déployé sur Vercel — match parfait.

---

### 6. Frontend Design (Anthropic) — 124K installs

**50 styles visuels avec typographie assortie.**

- Guidelines UI/UX professionnelles
- Design system codifié
- Responsive patterns

**Pourquoi pour DeepSight :** Améliore la qualité UI du frontend web et de l'extension Chrome.

---

### 7. Planning with Files — ⭐ 9.7K

**Planning style Manus avec fichiers markdown persistants.**

- Plans structurés en fichiers .md
- Suivi de progression persistant
- Décomposition de tâches complexes

**Pourquoi pour DeepSight :** Complète ton workflow Notion avec des plans techniques détaillés par tâche.

---

### 8. UI/UX Pro Max Skill — ⭐ 16.9K

**Intelligence design pour UI/UX professionnelle.**

- Design patterns avancés
- Accessibilité AA+
- Responsive design guidelines

**Pourquoi pour DeepSight :** Dark mode first, glassmorphism, système de spacing — tout ton design system y gagne.

---

## 🥈 TIER B — Utile selon le contexte

### 9. Claude-Mem (Long-term Memory)

**Mémoire persistante cross-sessions.**

- Retient contexte et préférences entre sessions
- Évite de re-expliquer l'architecture à chaque fois

**Pourquoi pour DeepSight :** Avec 13h/jour de dev, la persistance de contexte fait gagner du temps.

---

### 10. Senaiverse RN/Expo Agent System — 7 agents

**Toolkit complet pour apps React Native/Expo.**

- Agents spécialisés : accessibilité, design system, sécurité, performance, testing
- Automatisation de checks qualité

**Repo :** https://github.com/senaiverse/claude-code-reactnative-expo-agent-system

---

### 11. TypeScript LSP Plugin

**Type-checking réel via LSP dans le workflow Claude.**

- Détecte erreurs de types en temps réel
- Lint intégré au workflow agent

**Pourquoi pour DeepSight :** TypeScript strict sur frontend + mobile = ce plugin attrape les erreurs avant le build.

---

### 12. Fullstack Claude Skills (Jeffallan) — 66 skills

**Collection complète pour dev fullstack.**

- React, Node, Python, DevOps
- Patterns d'architecture clean
- Testing strategies

**Repo :** https://github.com/Jeffallan/claude-skills

---

## 📚 Repos "Awesome" à bookmarker

| Repo                                                                                            | Contenu                                                    |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)             | 500+ skills officiels (Anthropic, Vercel, Stripe, Expo...) |
| [rohitg00/awesome-claude-code-toolkit](https://github.com/rohitg00/awesome-claude-code-toolkit) | 135 agents, 35 skills, 120 plugins, 42 commandes           |
| [travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills)             | Liste curatée avec ressources et tutos                     |
| [Chat2AnyLLM/awesome-claude-skills](https://github.com/Chat2AnyLLM/awesome-claude-skills)       | 24,291 skills indexés (mis à jour quotidiennement)         |
| [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)         | Orchestrateurs, hooks, slash-commands                      |

---

## 🚀 Plan d'installation recommandé pour DeepSight

### Phase 1 — Immédiat (5 min)

```bash
# Superpowers (framework de dev structuré)
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace

# Code Review multi-agent
/plugin install code-review

# React Native best practices (Callstack officiel)
/plugin marketplace add callstackincubator/agent-skills
/plugin install react-native-best-practices@callstack-agent-skills
```

### Phase 2 — Cette semaine

```bash
# Vercel React patterns
npx add-skill vercel-react-best-practices

# Frontend design guidelines
npx add-skill frontend-design
```

### Phase 3 — Explorer

- Parcourir VoltAgent/awesome-agent-skills pour skills FastAPI/Python
- Tester senaiverse/claude-code-reactnative-expo-agent-system
- Évaluer Claude-Mem pour la persistance de contexte

---

_Note : Les commandes d'installation sont pour Claude Code CLI sur ton MSI-PC._
_Vérifie la compatibilité des versions avant installation._
