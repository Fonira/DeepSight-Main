---
description: "Conventions Git obligatoires pour le monorepo DeepSight. TOUJOURS consulter cette skill avant de proposer un commit, une branche, un merge, un rebase, ou une commande git."
---

Conventions Git — Monorepo DeepSight
Messages de commit (Conventional Commits)
Format : type(scope): description courte
Types
TypeUsagefeatNouvelle fonctionnalitéfixCorrection de bugrefactorRefactoring sans changement fonctionnelstyleFormatage, whitespace (pas de changement logique)docsDocumentation uniquementtestAjout ou modification de testschoreMaintenance, dépendances, configperfAmélioration de performanceciCI/CD, GitHub Actions, config déploiementhotfixFix urgent en production
Scopes (par plateforme)
ScopeDossierweb/frontendmobile/mobileapi/backendext/extensionsharedCode partagéinfraConfig déploiement, Docker, CIdbMigrations, schéma BDDstripePaiements, webhooks
Exemples
feat(api): add playlist corpus analysis endpoint
fix(mobile): resolve crash on empty transcript
refactor(web): migrate Studio Panel to zustand
chore(ext): bump manifest to v2.0.1
fix(db): add missing index on analyses.user_id
perf(api): cache Mistral responses in Redis
hotfix(api): fix JWT validation bypass
test(web): add Playwright tests for subscription flow
Règles

Français dans la description : accepté si plus naturel, mais l'anglais est préféré pour la cohérence
Première lettre en minuscule après le :
Pas de point final
Impératif présent ("add", "fix", "update", pas "added", "fixed")
Max 72 caractères pour la première ligne

Branches
Nommage
type/description-courte
Exemples :
feat/studio-flashcards
fix/mobile-auth-crash
refactor/subscription-ssot
hotfix/stripe-webhook-500
chore/update-expo-sdk
Workflow
main (production)
  └── feat/ma-feature (développement)

main = branche de production, auto-deploy Vercel + Railway
Travailler sur des branches feature, merge via PR ou direct push si petite modification solo
Pas de branche develop (overhead inutile en solo)

Commandes Git courantes (PowerShell Windows)
powershell# Nouveau feature
git checkout -b feat/nom-feature

# Commit standard
git add . ; git commit -m "feat(web): add comparison view"

# Push
git push origin feat/nom-feature

# Merge rapide en solo
git checkout main ; git merge feat/nom-feature ; git push origin main

# Supprimer la branche après merge
git branch -d feat/nom-feature

# Stash rapide
git stash ; git checkout main ; git stash pop

# Voir l'historique propre
git log --oneline -20
⚠️ RAPPEL : Utiliser ; et PAS && sur PowerShell Windows.
Cas particuliers
Commit multi-plateforme
Si un changement touche frontend + backend :
feat(api,web): add share endpoint and UI
Hotfix production
powershellgit checkout main
git checkout -b hotfix/description
# ... fix ...
git add . ; git commit -m "hotfix(api): fix critical auth bypass"
git checkout main ; git merge hotfix/description ; git push origin main
Annuler le dernier commit (pas encore pushé)
powershellgit reset --soft HEAD~1
Annuler le dernier commit (déjà pushé)
powershellgit revert HEAD ; git push origin main