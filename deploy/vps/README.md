# DeepSight sur un VPS unique : guide de remise en ligne

Un seul serveur, un **netcup VPS 500 G12.5** (2 vCPU, 4 Go de RAM, 64 Go SSD, snapshots inclus, Europe), héberge tout :

| Adresse | Servi par |
| --- | --- |
| `https://www.deepsightsynthesis.com` | Caddy, fichiers du build Vite (remplace Vercel) |
| `https://deepsightsynthesis.com` | redirection vers `www` |
| `https://api.deepsightsynthesis.com` | Caddy → API FastAPI |

PostgreSQL 17 et Redis 7 tournent dans Docker sur le même serveur, **sans aucun port ouvert vers Internet**. Le kit fonctionne sur n'importe quel VPS Debian 12/13 ou Ubuntu 24.04 ; seules les étapes 2 et 3 sont propres à netcup.

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

## 3. Déposer ta clé sur le serveur

netcup livre **Debian 13 (minimal)** : le kit le prend en charge tel quel, pas besoin de réinstaller. Ajoute ta clé avec le mot de passe root reçu dans l'email « Ihr vServer bei netcup ist bereitgestellt » (PowerShell, une seule fois) :

```powershell
Get-Content $env:USERPROFILE\.ssh\id_vps.pub | ssh root@IP_DU_VPS "mkdir -p ~/.ssh ; chmod 700 ~/.ssh ; cat >> ~/.ssh/authorized_keys ; chmod 600 ~/.ssh/authorized_keys"
```

À la première connexion, SSH demande de confirmer l'empreinte du serveur : elle doit correspondre à la ligne `ED25519` de l'email netcup. Tape `yes`, puis le mot de passe root.

Debian minimal n'a pas `git` : installe-le avant l'étape 5 (connecté en root) avec `apt-get update ; apt-get install -y git`.

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

Il tourne détaché de ta session : si SSH coupe, l'installation continue. Après reconnexion, `tail -f /var/log/deepsight-bootstrap.log` affiche où il en est. L'IP depuis laquelle tu le lances est exemptée de fail2ban. Sinon, des essais de mot de passe ratés juste avant feraient bannir ton IP en pleine installation (10 minutes). Si cela arrive quand même : console du SCP netcup, puis `fail2ban-client unban --all`.

## 6. Renseigner les clés

À partir de maintenant, on se connecte toujours en `deploy` :

```powershell
ssh -i $env:USERPROFILE\.ssh\id_vps deploy@IP_DU_VPS
```

```bash
nano /opt/deepsight/repo/.env.production
nano /opt/deepsight/repo/.env.frontend
```

Seul `ADMIN_EMAIL` est obligatoire. Sans `MISTRAL_API_KEY`, le site, la connexion et la base fonctionnent, mais pas les analyses ni le chat. Sans `SUPADATA_API_KEY`, les transcriptions YouTube passent par les méthodes de secours, souvent bloquées depuis un serveur. Ajoute ces clés dès que possible et relance `deploy.sh`. Laisse `PRIVATE_MODE=true` pour l'instant. Dans nano : `Ctrl+O` puis `Entrée` pour enregistrer, `Ctrl+X` pour quitter.

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

Sans argument, `deploy.sh` redéploie la branche déjà en place sur le serveur. Pour passer sur une autre branche (par exemple `main` une fois le kit fusionné), ajoute son nom après `deploy.sh` : elle devient la branche par défaut des déploiements suivants.

Diagnostic (sur le serveur) :

```bash
docker ps --format '{{.Names}}  {{.Status}}'
docker logs repo-backend-1 --tail 100 2>&1 | grep -i -E 'error|traceback|exception|critical'
docker logs repo-caddy-1 --tail 50
docker exec repo-backend-1 curl -s http://localhost:8080/health
free -h ; df -h /
```

Pour modifier la CSP ou les en-têtes du site : édite `frontend/vercel.json` (section `"source": "/(.*)"`), puis redéploie. `deploy.sh` régénère `caddy/generated/headers.caddy` à chaque fois.

`deploy.sh` valide aussi le `Caddyfile` avant tout build : si la nouvelle config est invalide, rien n'est déployé.

---

## Déployer depuis GitHub Actions

Le workflow `.github/workflows/deploy-vps.yml` lance `deploy.sh` sur le serveur, ce qui permet de déployer sans ton PC (par exemple depuis une session Claude). Sa clé SSH est **dédiée et bridée** : côté serveur, `authorized_keys` lui impose la commande `~/bin/deepsight-ci-deploy.sh` (copie de `scripts/ci-deploy.sh`), qui n'accepte que `deploy <branche>` et `status`. Pas de shell, pas de redirection de port.

**Mise en place (une seule fois, dans cmd sur ton PC, avec `gh` connecté au compte Fonira).** La clé privée passe directement du serveur au secret GitHub, sans jamais s'afficher, puis elle est supprimée du serveur :

```bat
ssh -i %USERPROFILE%\.ssh\id_vps deploy@62.83.136.156 "cd /opt/deepsight/repo ; git fetch -q origin feat/infra-ovh ; git reset -q --hard FETCH_HEAD ; bash deploy/vps/scripts/setup-ci-deploy.sh install"
ssh -i %USERPROFILE%\.ssh\id_vps deploy@62.83.136.156 "bash /opt/deepsight/repo/deploy/vps/scripts/setup-ci-deploy.sh known-hosts" | gh secret set VPS_KNOWN_HOSTS --repo Fonira/DeepSight-Main
ssh -i %USERPROFILE%\.ssh\id_vps deploy@62.83.136.156 "bash /opt/deepsight/repo/deploy/vps/scripts/setup-ci-deploy.sh private-key" | gh secret set VPS_DEPLOY_KEY --repo Fonira/DeepSight-Main
```

**Déployer :**
- pousser un tag `deploy-AAAAMMJJ-HHMM` sur la tête de la branche déployée (`feat/infra-ovh` par défaut, variable de dépôt `DEPLOY_BRANCH` pour en changer) : le workflow refuse un tag qui ne pointe pas sur la tête de cette branche ;
- ou, une fois le workflow présent sur `main`, le bouton « Run workflow » dans l'onglet Actions.

**Révoquer la clé** (sur le serveur) : `bash /opt/deepsight/repo/deploy/vps/scripts/setup-ci-deploy.sh revoke`, puis supprimer le secret `VPS_DEPLOY_KEY` dans GitHub. Pour mettre à jour la commande bridée après un changement de `ci-deploy.sh`, relancer `setup-ci-deploy.sh install` : la même clé publique est conservée.

---

## Sauvegardes

1. **Dump de la base** chaque nuit à 03h17 dans `/opt/deepsight/backups`, vérifié et conservé 14 jours. Journal : `/opt/deepsight/backups/backup.log`.
2. **Snapshot netcup** (inclus) : à créer dans le SCP avant toute opération risquée (mise à jour système, migration). Il se restaure en un clic depuis le SCP.

3. **Copie chiffrée sur Cloudflare R2** (bucket `deepsight-db-backups`, juridiction UE) après chaque dump, conservée 30 jours. Les fichiers sont chiffrés sur le serveur avant envoi : Cloudflare ne peut pas les lire. Mise en place, une seule fois, en tant que `deploy` :

   ```bash
   /opt/deepsight/repo/deploy/vps/scripts/setup-offsite-backup.sh
   ```

   Le script demande les deux clés d'un jeton R2 « Object Read & Write » limité au bucket (R2 → Manage API Tokens), dans n'importe quel ordre. Il génère ensuite une **phrase secrète** à ranger dans ton gestionnaire de mots de passe : sans elle, les copies R2 sont illisibles.

   Si le serveur est perdu, sur le nouveau :

   ```bash
   /opt/deepsight/repo/deploy/vps/scripts/setup-offsite-backup.sh --existing-passphrase
   RCLONE_CONFIG=/opt/deepsight/rclone.conf rclone lsl deepsight-crypt:
   RCLONE_CONFIG=/opt/deepsight/rclone.conf rclone copy deepsight-crypt:deepsight_AAAAMMJJ_HHMMSS.dump /opt/deepsight/backups/
   /opt/deepsight/repo/deploy/vps/scripts/restore.sh /opt/deepsight/backups/deepsight_AAAAMMJJ_HHMMSS.dump
   ```

Tu peux aussi rapatrier une copie sur ton PC (PowerShell) :

```powershell
New-Item -ItemType Directory -Force $env:USERPROFILE\Documents\DeepSight-backups | Out-Null ; scp -i $env:USERPROFILE\.ssh\id_vps "deploy@IP_DU_VPS:/opt/deepsight/backups/*.dump" $env:USERPROFILE\Documents\DeepSight-backups\
```

Sauvegarde manuelle et restauration, sur le serveur :

```bash
/opt/deepsight/repo/deploy/vps/scripts/backup.sh
ls -lh /opt/deepsight/backups
/opt/deepsight/repo/deploy/vps/scripts/restore.sh /opt/deepsight/backups/deepsight_AAAAMMJJ_HHMMSS.dump
```

---

## Passer plus tard par le proxy Cloudflare (optionnel)

Une fois les certificats obtenus, tu peux activer le nuage orange sur `www` et `api` pour la protection DDoS de Cloudflare. Dans ce cas, mets **SSL/TLS → Full (strict)** dans Cloudflare, sinon le site boucle en redirections.

## Monter en puissance

Si la RAM sature (`free -h`) : passe au **VPS 1000 G12.5** (4 vCPU, 8 Go) depuis le Customer Control Panel netcup. Garde `UVICORN_WORKERS=1` tant que les tâches playlist, les notifications et les planificateurs vivent en mémoire du process ; plusieurs workers les dupliquent ou les perdent.

---

## Différences avec l'ancienne infra (Hetzner + Vercel)

| | Avant | Maintenant |
| --- | --- | --- |
| Site web | Vercel | Caddy sur le VPS, réécritures de `vercel.json` reprises dans le `Caddyfile` |
| En-têtes / CSP | `vercel.json` | toujours `vercel.json`, converti à chaque déploiement |
| Redis | sans mot de passe, déjà signalé ouvert (BSI, février 2026) | mot de passe obligatoire, aucun port publié |
| Workers API | 4 (16 Go de RAM) | 1 (état en mémoire du process), réglable via `UVICORN_WORKERS` |
| Sauvegardes | APScheduler → R2, non vérifiées | dump vérifié chaque nuit, copie chiffrée sur R2 (UE) + snapshots netcup |

**Pas repris** (à refaire si besoin) : la fonction Vercel `/api/prerender` (pages simplifiées pour les robots d'IA), `/api/status`, `vault-mcp`, les aperçus `studio` et les démos sur `sslip.io`.
