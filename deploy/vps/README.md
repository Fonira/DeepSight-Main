# DeepSight sur un VPS unique : guide de remise en ligne

Un seul serveur, un **netcup VPS 500 G12.5** (2 vCPU, 4 Go de RAM, 64 Go SSD, snapshots inclus, Europe), héberge tout :

| Adresse | Servi par |
| --- | --- |
| `https://www.deepsightsynthesis.com` | Caddy, fichiers du build Vite (remplace Vercel) |
| `https://deepsightsynthesis.com` | redirection vers `www` |
| `https://api.deepsightsynthesis.com` | Caddy → API FastAPI |

PostgreSQL 17 et Redis 7 tournent dans Docker sur le même serveur, **sans aucun port ouvert vers Internet**. Le kit fonctionne sur n'importe quel VPS Ubuntu 24.04 ; seules les étapes 2 et 3 sont propres à netcup.

> Les commandes `PowerShell` se tapent sur ton PC Windows. Les blocs `bash` se tapent **sur le serveur**, après connexion SSH. Remplace `IP_DU_VPS` par l'adresse IPv4 de ton serveur.

---

## 1. Créer une clé SSH (PowerShell)

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\id_vps -C "deepsight-vps"
Get-Content $env:USERPROFILE\.ssh\id_vps.pub | Set-Clipboard
```

La clé publique est copiée dans le presse-papiers.

## 2. Commander le serveur (netcup)

netcup.com → **Server** → **VPS** → **VPS 500 G12.5**, durée **1 mois**, localisation **No preference Europe**. Après le paiement, netcup envoie par email :

- l'**adresse IPv4** du serveur ;
- les accès au **Server Control Panel (SCP)** et le mot de passe root.

La mise à disposition peut prendre de quelques heures à un jour (netcup l'annonce en ce moment).

## 3. Installer Ubuntu 24.04 avec ta clé

Dans le SCP (servercontrolpanel.de) → ton serveur → **Media** → **Images** : choisis **Ubuntu 24.04**. Si le formulaire propose une clé SSH, colle la clé de l'étape 1.

S'il ne la propose pas, ajoute-la avec le mot de passe root reçu par email (PowerShell, une seule fois) :

```powershell
Get-Content $env:USERPROFILE\.ssh\id_vps.pub | ssh root@IP_DU_VPS "mkdir -p ~/.ssh ; cat >> ~/.ssh/authorized_keys ; chmod 600 ~/.ssh/authorized_keys"
```

## 4. Pointer le DNS (Cloudflare)

dash.cloudflare.com → `deepsightsynthesis.com` → **DNS** → **Records** :

| Type | Nom | Contenu | Proxy |
| --- | --- | --- | --- |
| A | `@` | `IP_DU_VPS` | **DNS only** (nuage gris) |
| A | `www` | `IP_DU_VPS` | **DNS only** |
| A | `api` | `IP_DU_VPS` | **DNS only** |

- Supprime les enregistrements `CNAME` de `@` et `www` vers `cname.vercel-dns.com`, l'ancien `A` de `api` vers `89.167.23.214` (Hetzner), ainsi que `vault-mcp`, `coffre`, `n8n` et `status`.
- **Ne touche pas** aux enregistrements `MX` et `TXT`, ni à `send`, `cdn`, `google._domainkey`, `resend._domainkey`, `_dmarc` : ce sont les emails et les miniatures.
- Le nuage gris est obligatoire au premier déploiement : Caddy doit joindre le serveur directement pour obtenir les certificats HTTPS.

Vérifier la propagation :

```powershell
Resolve-DnsName api.deepsightsynthesis.com -Type A ; Resolve-DnsName www.deepsightsynthesis.com -Type A
```

## 5. Préparer le serveur

```powershell
ssh -i $env:USERPROFILE\.ssh\id_vps root@IP_DU_VPS
```

Puis, sur le serveur :

```bash
git clone --depth 50 https://github.com/Fonira/DeepSight-Main.git ~/ds-bootstrap
bash ~/ds-bootstrap/deploy/vps/scripts/bootstrap.sh
exit
```

Le script crée l'utilisateur `deploy` (avec ta clé), installe Docker, le pare-feu et le swap, interdit la connexion root et par mot de passe, clone le repo dans `/opt/deepsight/repo`, crée les fichiers `.env` avec des mots de passe aléatoires et programme la sauvegarde nocturne. Il peut être relancé sans risque.

## 6. Renseigner les clés

À partir de maintenant, on se connecte toujours en `deploy` :

```powershell
ssh -i $env:USERPROFILE\.ssh\id_vps deploy@IP_DU_VPS
```

```bash
nano /opt/deepsight/repo/.env.production
nano /opt/deepsight/repo/.env.frontend
```

Minimum pour démarrer : `ADMIN_EMAIL` et `MISTRAL_API_KEY`. Laisse `PRIVATE_MODE=true` pour l'instant. Dans nano : `Ctrl+O` puis `Entrée` pour enregistrer, `Ctrl+X` pour quitter.

## 7. Déployer

```bash
/opt/deepsight/repo/deploy/vps/scripts/deploy.sh
```

Premier déploiement : 5 à 10 minutes (build de l'image Python et du site). Les suivants sont plus rapides.

## 8. Vérifier

```powershell
curl.exe -s https://api.deepsightsynthesis.com/health ; Start-Process https://www.deepsightsynthesis.com
```

Connecte-toi sur le site avec `ADMIN_EMAIL` et le mot de passe admin généré :

```bash
grep '^ADMIN_PASSWORD=' /opt/deepsight/repo/.env.production
```

Le compte admin est créé automatiquement au démarrage de l'API.

## 9. Rouvrir DeepSight au public

Quand tout fonctionne : passe `PRIVATE_MODE=false` dans `.env.production`, puis relance `deploy.sh`.

---

## Au quotidien

Déployer la dernière version de `main` depuis ton PC :

```powershell
ssh -i $env:USERPROFILE\.ssh\id_vps deploy@IP_DU_VPS "/opt/deepsight/repo/deploy/vps/scripts/deploy.sh"
```

Déployer une autre branche : ajouter son nom après `deploy.sh`.

Diagnostic (sur le serveur) :

```bash
docker ps --format '{{.Names}}  {{.Status}}'
docker logs repo-backend-1 --tail 100 2>&1 | grep -i -E 'error|traceback|exception|critical'
docker logs repo-caddy-1 --tail 50
docker exec repo-backend-1 curl -s http://localhost:8080/health
free -h ; df -h /
```

Pour modifier la CSP ou les en-têtes du site : édite `frontend/vercel.json` (section `"source": "/(.*)"`), puis redéploie. `deploy.sh` régénère `caddy/generated/headers.caddy` à chaque fois.

---

## Sauvegardes

1. **Dump de la base** chaque nuit à 03h17 dans `/opt/deepsight/backups`, vérifié et conservé 14 jours. Journal : `/opt/deepsight/backups/backup.log`.
2. **Snapshot netcup** (inclus) : à créer dans le SCP avant toute opération risquée (mise à jour système, migration). Il se restaure en un clic depuis le SCP.

Les deux restent chez netcup. Pour ne plus jamais tout perdre d'un coup, rapatrie régulièrement une copie sur ton PC (PowerShell) :

```powershell
New-Item -ItemType Directory -Force $env:USERPROFILE\Documents\DeepSight-backups | Out-Null ; scp -i $env:USERPROFILE\.ssh\id_vps "deploy@IP_DU_VPS:/opt/deepsight/backups/*.dump" $env:USERPROFILE\Documents\DeepSight-backups\
```

Sauvegarde manuelle et restauration, sur le serveur :

```bash
/opt/deepsight/repo/deploy/vps/scripts/backup.sh
ls -lh /opt/deepsight/backups
/opt/deepsight/repo/deploy/vps/scripts/restore.sh /opt/deepsight/backups/deepsight_AAAAMMJJ_HHMMSS.dump
```

Copie automatique hors serveur (optionnel, plus tard) : installer `rclone`, configurer un stockage S3, puis écrire `RCLONE_REMOTE=nom-du-remote:bucket` dans `/opt/deepsight/backup.env`.

---

## Passer plus tard par le proxy Cloudflare (optionnel)

Une fois les certificats obtenus, tu peux activer le nuage orange sur `www` et `api` pour la protection DDoS de Cloudflare. Dans ce cas, mets **SSL/TLS → Full (strict)** dans Cloudflare, sinon le site boucle en redirections.

## Monter en puissance

Si la RAM sature (`free -h`) : passe au **VPS 1000 G12.5** (4 vCPU, 8 Go) depuis le Customer Control Panel netcup, puis mets `UVICORN_WORKERS=4` dans `.env.production` et relance `deploy.sh`.

---

## Différences avec l'ancienne infra (Hetzner + Vercel)

| | Avant | Maintenant |
| --- | --- | --- |
| Site web | Vercel | Caddy sur le VPS, réécritures de `vercel.json` reprises dans le `Caddyfile` |
| En-têtes / CSP | `vercel.json` | toujours `vercel.json`, converti à chaque déploiement |
| Redis | sans mot de passe, déjà signalé ouvert (BSI, février 2026) | mot de passe obligatoire, aucun port publié |
| Workers API | 4 (16 Go de RAM) | 2 (4 Go), réglable via `UVICORN_WORKERS` |
| Sauvegardes | APScheduler → R2, non vérifiées | dump vérifié chaque nuit + snapshots netcup |

**Pas repris** (à refaire si besoin) : la fonction Vercel `/api/prerender` (pages simplifiées pour les robots d'IA), `/api/status`, `vault-mcp`, les aperçus `studio` et les démos sur `sslip.io`.
