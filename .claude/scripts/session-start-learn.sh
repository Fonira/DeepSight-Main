#!/bin/bash
# Session start hook — Charge les apprentissages au démarrage
# Rappelle à Claude de consulter LEARNINGS.md avant toute action

LEARNINGS_FILE="$(git rev-parse --show-toplevel 2>/dev/null)/.claude/LEARNINGS.md"

if [ ! -f "$LEARNINGS_FILE" ]; then
  exit 0
fi

# Compter les entrées par section
AVOID_COUNT=$(grep -c "^### \[" <<< "$(sed -n '/^## À ÉVITER/,/^## /p' "$LEARNINGS_FILE")" 2>/dev/null || echo "0")
SOLUTIONS_COUNT=$(grep -c "^### \[" <<< "$(sed -n '/^## SOLUTIONS VALIDÉES/,/^## /p' "$LEARNINGS_FILE")" 2>/dev/null || echo "0")
PATTERNS_COUNT=$(grep -c "^### " <<< "$(sed -n '/^## PATTERNS RÉCURRENTS/,/^## /p' "$LEARNINGS_FILE")" 2>/dev/null || echo "0")

cat << PROMPT
[LEARNING SYSTEM ACTIF] Base de connaissances chargée.
- À éviter (contextuels) : ~${AVOID_COUNT} entrées
- Solutions validées : ~${SOLUTIONS_COUNT} entrées
- Patterns récurrents : ~${PATTERNS_COUNT} entrées
- Fichier : .claude/LEARNINGS.md

RAPPEL : Avant toute tâche de deploy, fix, ou infra → consulter LEARNINGS.md.
⚠️ Les entrées "À ÉVITER" sont CONTEXTUELLES — vérifier QUAND/SCOPE/EXPIRE avant d'appliquer.
PROMPT
