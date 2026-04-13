---
description: "Procédures de déploiement pour les 4 plateformes DeepSight. Utiliser cette skill quand l'utilisateur veut déployer, publier, mettre en production, ou diagnostiquer un échec de déploiement."
---

# Procédures de Déploiement DeepSight

## Frontend Web → Vercel

Auto-deploy activé sur branche `main`.

**Déploiement manuel :**

```powershell
cd C:\Users\33667\DeepSight-Main\frontend
vercel --prod
```

**Checklist pré-deploy :**

- Build local OK : `npm run build`
- Variables d'env à jour sur Vercel Dashboard
- Toutes les `VITE_*` présentes pour le client
- Pas d'erreur TypeScript : `npx tsc --noEmit`

**Rollback :** via Vercel Dashboard → Deployments → Promote précédent

---

## Backend Python → Hetzner VPS Docker

Pas d'auto-deploy — déploiement manuel via SSH.

```powershell
ssh -i C:\Users\33667\.ssh\id_hetzner root@89.167.23.214 "cd /opt/deepsight/repo ; git pull ; docker build -t deepsight-backend:latest -f deploy/hetzner/Dockerfile ./backend ; docker stop repo-backend-1 ; docker rm repo-backend-1 ; docker run -d --name repo-backend-1 --network repo_deepsight --env-file /opt/deepsight/repo/.env.production -e PORT=8080 -e ENV=production --restart unless-stopped --health-cmd 'curl -f http://localhost:8080/health || exit 1' --health-interval 30s --health-timeout 10s --health-retries 3 deepsight-backend:latest"
```

**Checklist pré-deploy :**

- `pytest` passe localement
- Si migration BDD : backup effectué en premier
- Variables dans `/opt/deepsight/repo/.env.production` à jour
- `CORS_ORIGINS` inclut toutes les origines prod
- Stripe en live mode
- Pas de `print()` debug dans le code

**Rollback :** `git log` sur le VPS, `git checkout <commit>`, rebuild Docker

---

## Mobile → EAS (Expo Application Services)

**Build :**

```powershell
cd C:\Users\33667\DeepSight-Main\mobile

# Build preview (test interne)
eas build --platform all --profile preview

# Build production
eas build --platform all --profile production
```

**Submit (stores) :**

```powershell
eas submit --platform ios      # App Store Connect
eas submit --platform android  # Google Play Console
```

**OTA Updates (sans rebuild) :**

```powershell
eas update --branch production --message "fix: description"
```

**Checklist pré-build :**

- Version bump dans `app.json` (version + buildNumber/versionCode)
- `eas.json` profiles corrects
- Variables d'env EAS Secrets configurées
- Test sur Expo Go avant build natif

---

## Extension Chrome → Chrome Web Store

**Build :**

```powershell
cd C:\Users\33667\DeepSight-Main\extension
npm run build
```

**Package :**

```powershell
Compress-Archive -Path .\dist\* -DestinationPath .\extension-v2.0.zip
```

**Upload :**

1. Aller sur https://chrome.google.com/webstore/devconsole
2. Uploader le ZIP
3. Soumettre pour review

**Checklist pré-publish :**

- `manifest.json` version incrémentée
- Manifest V3
- Pas d'extraction de transcript côté extension (server-side only)
- Permissions minimales
- Screenshots et description à jour

---

## Vérification post-deploy (toutes plateformes)

1. Tester : `GET https://api.deepsightsynthesis.com/health`
2. Vérifier les logs : `docker logs repo-backend-1 --tail 50`
3. Parcours complet (inscription → analyse → résultat)
4. Vérifier Stripe webhook si modification paiement
5. Tester sur mobile si changement API
