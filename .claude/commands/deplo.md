---
allowed-tools: Read, Bash, Glob, Grep
description: Procédures de déploiement pour les 4 plateformes DeepSight
---

# Déploiement DeepSight

Déployer la plateforme : $ARGUMENTS

(Si pas de plateforme spécifiée, demander : web, backend, mobile, ou extension ?)

## Frontend Web → Vercel
Auto-deploy sur `main`. Manuel : `vercel --prod`
Checklist : build OK, env vars Vercel, `VITE_*` présentes, pas d'erreur TS.

## Backend → Hetzner VPS Docker
```powershell
ssh -i C:\Users\33667\.ssh\id_hetzner root@89.167.23.214 "cd /opt/deepsight/repo ; git pull ; docker build -t deepsight-backend:latest -f deploy/hetzner/Dockerfile ./backend ; docker stop repo-backend-1 ; docker rm repo-backend-1 ; docker run -d --name repo-backend-1 --network repo_deepsight --env-file /opt/deepsight/repo/.env.production -e PORT=8080 -e ENV=production --restart unless-stopped --health-cmd 'curl -f http://localhost:8080/health || exit 1' --health-interval 30s --health-timeout 10s --health-retries 3 deepsight-backend:latest"
```
Checklist : pytest OK, backup BDD si migration, `.env.production` à jour, CORS_ORIGINS correct, Stripe live.

## Mobile → EAS
```powershell
cd C:\Users\33667\DeepSight-Main\mobile
eas build --platform all --profile $ARGUMENTS
eas update --branch production --message "fix: description"
```
Checklist : version bump app.json, EAS Secrets configurées, test Expo Go.

## Extension Chrome → Chrome Web Store
```powershell
cd C:\Users\33667\DeepSight-Main\extension
npm run build
Compress-Archive -Path .\dist\* -DestinationPath .\extension-v2.0.zip
```
Checklist : manifest version++, MV3, permissions minimales.

## Post-deploy (toutes plateformes)
1. `GET https://api.deepsightsynthesis.com/health`
2. `docker logs repo-backend-1 --tail 50`
3. Parcours complet (inscription → analyse → résultat)
4. Vérifier Stripe webhook si modification paiement