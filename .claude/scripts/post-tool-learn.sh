#!/bin/bash
# Post-tool hook — Détecte les échecs répétés d'outils et déclenche un apprentissage
# Se déclenche après chaque appel Bash

FAIL_COUNTER_FILE="/tmp/claude-fail-counter-$$"
TOOL_NAME="${CLAUDE_TOOL_NAME:-unknown}"
EXIT_CODE="${CLAUDE_TOOL_EXIT_CODE:-0}"

# Ne tracker que les commandes Bash
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

# Si la commande a réussi, reset le compteur
if [ "$EXIT_CODE" = "0" ]; then
  echo "0" > "$FAIL_COUNTER_FILE"
  exit 0
fi

# Incrémenter le compteur d'échecs consécutifs
COUNT=$(cat "$FAIL_COUNTER_FILE" 2>/dev/null || echo "0")
COUNT=$((COUNT + 1))
echo "$COUNT" > "$FAIL_COUNTER_FILE"

# Après 3 échecs consécutifs → alerte
if [ "$COUNT" -ge 3 ]; then
  echo "0" > "$FAIL_COUNTER_FILE"
  cat << 'PROMPT'
[AUTO-LEARN ALERTE] 3+ échecs consécutifs détectés sur des commandes Bash.

STOP. Avant de retenter :
1. Consulte `.claude/LEARNINGS.md` — ce problème est peut-être déjà documenté
2. Si tu tournes en rond, change d'approche IMMÉDIATEMENT
3. Documente ce qui échoue pour la prochaine fois

Ne retente PAS la même approche. Cherche une alternative.
PROMPT
fi
