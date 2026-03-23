---
allowed-tools: Read, Edit, Write, Grep, Glob
description: Prompts Mistral AI et pipeline d'analyse DeepSight — modes, features Studio, chunking
---

# Prompts Mistral

Modifier / créer le prompt pour : $ARGUMENTS

## Pipeline : URL → Transcript → Chunking (>8000 tokens) → Mistral (mode + feature)

## Config par feature
synthesis: temp=0.3, max=4096 | flashcards: temp=0.2, max=2048 | quiz: temp=0.4, max=2048
mindmap: temp=0.2, max=2048 | factcheck: temp=0.1, max=1024 | compare: temp=0.3, max=6144

## System prompt : "Tu es DeepSight, analyse de contenu vidéo YouTube. UNIQUEMENT basé sur le transcript. Ne jamais inventer."

## Modes
- ACCESSIBLE (Découverte) : 1 phrase + 3-5 points clés + 1 insight
- STANDARD (Étudiant+) : résumé exécutif + idées + arguments + limites + applications
- EXPERT (Starter+) : thèse + structure argumentative + preuves + biais + évaluation critique

## Features Studio (toutes en JSON strict)
- Flashcards : 8-15 cards `{question, answer, category}`
- Quiz : 5-10 questions `{question, options, correct, explanation, difficulty}`
- Mindmap : max 4 branches, 3 niveaux `{title, branches[{label, children}]}`
- Factcheck : extraction claims → Perplexity → synthèse `{score 0-100, results[{verdict}]}`
- Compare : convergences + divergences + tableau + recommandation

## Chunking : MAX_TOKENS=6000, OVERLAP=200. Multi-chunk → synthèses partielles → méta-synthèse.

## Anti-patterns : temp haute pour flashcards, JSON sans "strict", parser sans try/catch, ignorer longueur transcript