#!/bin/bash
# Auto-learn hook — Analyse la session et rappelle d'enregistrer les apprentissages
# Déclenché à chaque Stop (fin de réponse Claude)

LEARNINGS_FILE="$(git rev-parse --show-toplevel 2>/dev/null)/.claude/LEARNINGS.md"

# Si le fichier LEARNINGS n'existe pas, ne rien faire
if [ ! -f "$LEARNINGS_FILE" ]; then
  exit 0
fi

# Compteur de stops dans cette session (pour ne pas spammer)
COUNTER_FILE="/tmp/claude-learn-counter-$$"
if [ ! -f "$COUNTER_FILE" ]; then
  echo "0" > "$COUNTER_FILE"
fi

COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo "0")
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNTER_FILE"

# Ne déclencher l'auto-learn que toutes les 5 réponses (pas à chaque stop)
# et seulement après au moins 3 échanges (session substantielle)
if [ "$COUNT" -lt 3 ]; then
  exit 0
fi

if [ $((COUNT % 5)) -ne 0 ]; then
  exit 0
fi

# Injecter le rappel dans le contexte Claude
cat << 'PROMPT'
[AUTO-LEARN CHECKPOINT] Tu as fait plusieurs échanges dans cette session.
Fais une auto-évaluation rapide (ne réponds PAS à l'utilisateur avec ça, c'est interne) :

1. As-tu rencontré un problème qui a nécessité > 1 tentative ?
2. As-tu trouvé une solution non évidente qui mériterait d'être documentée ?
3. As-tu utilisé une approche qui pourrait échouer dans un autre contexte ?

Si OUI à l'une de ces questions → mets à jour `.claude/LEARNINGS.md` silencieusement :
- Ajoute en BLACKLIST les approches échouées
- Ajoute en SOLUTIONS VALIDÉES ce qui a fonctionné
- N'en parle PAS à l'utilisateur sauf s'il demande

Si NON → ne fais rien, continue normalement.
PROMPT
