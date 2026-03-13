# Prompt de synchronisation mémoire DeepSight

> Colle ce prompt au début d'une nouvelle session Claude pour qu'il se mette à jour.

---

## Prompt à copier-coller :

```
Avant de commencer quoi que ce soit, synchronise ta mémoire projet :

1. Lis `.claude/CLAUDE.md` (mémoire persistante Cowork) — c'est ta source de vérité pour l'état du projet, l'infra, les bugs connus, et les actions en attente.

2. Lis `CLAUDE.md` à la racine du repo (guide technique complet).

3. Regarde `git log --oneline -10` pour voir les derniers changements.

4. Si tu découvres une info nouvelle pendant cette session (changement de config, bug résolu, nouveau service, etc.), tu DOIS mettre à jour `.claude/CLAUDE.md` pour que la prochaine session soit au courant.

5. Vérifie rapidement l'état des services :
   - curl https://api.deepsightsynthesis.com/health
   - curl https://deep-sight-backend-v3-production.up.railway.app/health

Ensuite, dis-moi ce que tu as appris et demande-moi quelle tâche on attaque.
```

---

## Variante courte (pour sessions rapides) :

```
Lis .claude/CLAUDE.md et git log --oneline -10, puis dis-moi l'état du projet. Mets à jour CLAUDE.md si tu apprends quelque chose de nouveau pendant la session.
```
