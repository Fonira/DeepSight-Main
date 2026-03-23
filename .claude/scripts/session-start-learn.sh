#!/bin/bash
# Session start hook — Charge les apprentissages au démarrage
# Rappelle à Claude de consulter LEARNINGS.md avant toute action

LEARNINGS_FILE="$(git rev-parse --show-toplevel 2>/dev/null)/.claude/LEARNINGS.md"

if [ ! -f "$LEARNINGS_FILE" ]; then
  exit 0
fi

# Compter les entrées pour donner un résumé
BLACKLIST_COUNT=$(grep -c "^### \[" "$LEARNINGS_FILE" 2>/dev/null | head -1)
SOLUTIONS_COUNT=$(grep -c "^### \[.*\]" "$LEARNINGS_FILE" 2>/dev/null | head -1)

cat << PROMPT
[LEARNING SYSTEM ACTIF] Base de connaissances chargée.
- Entrées documentées : ~${BLACKLIST_COUNT:-0} approches/solutions
- Fichier : .claude/LEARNINGS.md

RAPPEL : Avant toute tâche de deploy, fix, ou infra → consulter LEARNINGS.md pour éviter de répéter des approches qui ont déjà échoué.
PROMPT
