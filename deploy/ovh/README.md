# DeepSight sur OVHcloud — guide de remise en ligne

Un seul VPS OVHcloud **VPS-1** (2 vCPU, 4 Go de RAM, 40 Go NVMe, sauvegarde quotidienne incluse) héberge tout :

| Adresse | Servi par |
| --- | --- |
| `https://www.deepsightsynthesis.com` | Caddy, fichiers du build Vite (remplace Vercel) |
| `https://deepsightsynthesis.com` | redirection vers `www` |
| `https://api.deepsightsynthesis.com` | Caddy → API FastAPI |

PostgreSQL 17 et Redis 7 tournent dans Docker sur le même serveur, **sans aucun port ouvert vers Internet**.

> Les commandes `PowerShell` se tapent sur ton PC Windows. Les blocs `bash` se tapent **sur le serveur**, après connexion SSH.

---

## 0. Avant tout : le domaine

`deepsightsynthesis.com` est chez **Cloudflare Registrar** et le renouvellement automatique échoue. Renouvelle-le dans le tableau de bord Cloudflare (**Domain Registration → Manage Domains**) avec une carte valide **avant la date d'expiration**. Sans domaine, rien de ce qui suit ne fonctionne.

---

## 1. Créer une clé SSH (PowerShell)

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\id_ovh -C "deepsight-ovh"
Get-Content $env:USERPROFILE\.ssh\id_ovh.pub | Set-Clipboard
```

La clé publique est copiée dans le presse-papiers : tu la colles à l'étape suivante.

## 2. Commander le VPS

Sur ovhcloud.com → **VPS** → **VPS-1** :

- **Image** : Ubuntu 24.04
- **Localisation** : France (Gravelines, Roubaix ou Strasbourg)
- **Clé SSH** : coller la clé publique de l'étape 1

Note l'**adresse IPv4** du serveur reçue par email ou dans l'espace client (ci-dessous : `IP_DU_VPS`).

## 3. Pointer le DNS (Cloudflare)

dash.cloudflare.com → `deepsightsynthesis.com` → **DNS** → **Records** :

| Type | Nom | Contenu | Proxy |
| --- | --- | --- | --- |
| A | `@` | `IP_DU_VPS` | **DNS only** (nuage gris) |
| A | `www` | `IP_DU_VPS` | **DNS only** |
| A | `api` | `IP_DU_VPS` | **DNS only** |

- Supprime les anciens enregistrements qui pointaient vers Vercel (`cname.vercel-dns.com`, `76.76.21.21`) ou vers l'ancien Hetzner (`89.167.23.214`).
- **Ne touche pas** aux enregistrements `MX` et `TXT` : ce sont ceux des emails.
- Le nuage gris est obligatoire au premier déploiement : Caddy doit joindre le serveur directement pour obtenir les certificats HTTPS.

Vérifier la propagation (PowerShell) :

```powershell
Resolve-DnsName api.deepsightsynthesis.com -Type A ; Resolve-DnsName www.deepsightsynthesis.com -Type A
```

## 4. Préparer le serveur

```powershell
ssh -i $env:USERPROFILE\.ssh\id_ovh ubuntu@IP_DU_VPS
```

Puis, sur le serveur :

```bash
git clone --depth 50 https://github.com/Fonira/DeepSight-Main.git ~/ds-bootstrap
sudo bash ~/ds-bootstrap/deploy/ovh/scripts/bootstrap.sh
exit
```

Le script installe Docker, le pare-feu, le swap, verrouille SSH (clé uniquement), clone le repo dans `/opt/deepsight/repo`, crée les fichiers `.env` avec des mots de passe aléatoires et programme la sauvegarde nocturne. Il peut être relancé sans risque.

## 5. Renseigner les clés

Reconnecte-toi (le `exit` ci-dessus est nécessaire pour que Docker soit utilisable sans sudo) :

```powershell
ssh -i $env:USERPROFILE\.ssh\id_ovh ubuntu@IP_DU_VPS
```

```bash
nano /opt/deepsight/repo/.env.production
nano /opt/deepsight/repo/.env.frontend
```

Minimum pour démarrer : `ADMIN_EMAIL` et `MISTRAL_API_KEY`. Laisse `PRIVATE_MODE=true` pour l'instant. Dans nano : `Ctrl+O` puis `Entrée` pour enregistrer, `Ctrl+X` pour quitter.

## 6. Déployer

```bash
/opt/deepsight/repo/deploy/ovh/scripts/deploy.sh
```

Premier déploiement : 5 à 10 minutes (build de l'image Python et du site). Les suivants sont plus rapides.

## 7. Vérifier

```powershell
curl.exe -s https://api.deepsightsynthesis.com/health ; Start-Process https://www.deepsightsynthesis.com
```

Connecte-toi sur le site avec `ADMIN_EMAIL` et le mot de passe admin généré :

```bash
grep '^ADMIN_PASSWORD=' /opt/deepsight/repo/.env.production
```

Le compte admin est créé automatiquement au démarrage de l'API.

## 8. Rouvrir DeepSight au public

Quand tout fonctionne : passe `PRIVATE_MODE=false` dans `.env.production`, puis relance `deploy.sh`.

---

## Au quotidien

Déployer la dernière version de `main` depuis ton PC :

```powershell
ssh -i $env:USERPROFILE\.ssh\id_ovh ubuntu@IP_DU_VPS "/opt/deepsight/repo/deploy/ovh/scripts/deploy.sh"
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

Deux niveaux, sans rien payer de plus :

1. **Sauvegarde OVH du VPS** (incluse dans VPS-1, quotidienne). Elle se restaure depuis l'espace client OVH.
2. **Dump de la base** chaque nuit à 03h17 dans `/opt/deepsight/backups`, conservé 14 jours. Journal : `/opt/deepsight/backups/backup.log`.

Les deux sont sur l'infrastructure OVH. Pour ne plus jamais tout perdre d'un coup, rapatrie régulièrement une copie sur ton PC (PowerShell) :

```powershell
New-Item -ItemType Directory -Force $env:USERPROFILE\Documents\DeepSight-backups | Out-Null ; scp -i $env:USERPROFILE\.ssh\id_ovh "ubuntu@IP_DU_VPS:/opt/deepsight/backups/*.dump" $env:USERPROFILE\Documents\DeepSight-backups\
```

Sauvegarde manuelle (avant une opération risquée) et restauration, sur le serveur :

```bash
/opt/deepsight/repo/deploy/ovh/scripts/backup.sh
ls -lh /opt/deepsight/backups
/opt/deepsight/repo/deploy/ovh/scripts/restore.sh /opt/deepsight/backups/deepsight_AAAAMMJJ_HHMMSS.dump
```

Copie automatique hors serveur (optionnel, plus tard) : installer `rclone`, configurer un stockage S3 (OVH Object Storage par exemple), puis écrire `RCLONE_REMOTE=nom-du-remote:bucket` dans `/opt/deepsight/backup.env`.

---

## Passer plus tard par le proxy Cloudflare (optionnel)

Une fois les certificats obtenus, tu peux activer le nuage orange sur `www` et `api` pour la protection DDoS de Cloudflare. Dans ce cas, mets **SSL/TLS → Full (strict)** dans Cloudflare, sinon le site boucle en redirections.

## Passer au VPS-2

Si la RAM sature (`free -h`) : upgrade VPS-2 en un clic dans l'espace client OVH (4 vCPU, 8 Go), puis `UVICORN_WORKERS=4` dans `.env.production` et `deploy.sh`.

---

## Différences avec l'ancienne infra (Hetzner + Vercel)

| | Avant | Maintenant |
| --- | --- | --- |
| Site web | Vercel | Caddy sur le VPS, réécritures de `vercel.json` reprises dans le `Caddyfile` |
| En-têtes / CSP | `vercel.json` | toujours `vercel.json`, converti à chaque déploiement |
| Redis | sans mot de passe, déjà signalé ouvert (BSI, février 2026) | mot de passe obligatoire, aucun port publié |
| Workers API | 4 (16 Go de RAM) | 2 (4 Go), réglable via `UVICORN_WORKERS` |
| Sauvegardes | APScheduler → R2, non vérifiées | dump vérifié chaque nuit + sauvegarde OVH |

**Pas repris** (à refaire si besoin) : la fonction Vercel `/api/prerender` (pages simplifiées pour les robots d'IA), `/api/status`, `vault-mcp`, les aperçus `studio` et les démos sur `sslip.io`.
