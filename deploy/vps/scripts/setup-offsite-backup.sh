#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# DeepSight — copie chiffrée des sauvegardes vers Cloudflare R2 (juridiction UE)
#
# À lancer une fois sur le serveur, en tant que "deploy" :
#   /opt/deepsight/repo/deploy/vps/scripts/setup-offsite-backup.sh
#
# Prérequis : un bucket R2 en juridiction UE (défaut : deepsight-db-backups) et un
# jeton d'API R2 "Object Read & Write" limité à ce bucket.
#
# Ce que fait le script :
#   1. installe rclone
#   2. demande les deux clés du jeton, dans n'importe quel ordre (rien n'est affiché)
#   3. génère une phrase secrète : les dumps sont chiffrés AVANT de quitter le
#      serveur, Cloudflare ne voit que des fichiers illisibles
#   4. écrit /opt/deepsight/rclone.conf et /opt/deepsight/backup.env (droits 600),
#      lus par backup.sh à chaque sauvegarde nocturne
#   5. lance une sauvegarde de test et vérifie qu'elle est relisible depuis R2
#
# Options :
#   --force                remplace une configuration existante
#   --existing-passphrase  saisit une phrase secrète existante au lieu d'en générer
#                          une (nouveau serveur qui doit relire les anciennes copies)
# Variables optionnelles : R2_BUCKET (défaut : deepsight-db-backups), R2_ACCOUNT_ID
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

BUCKET="${R2_BUCKET:-deepsight-db-backups}"
# Identifiant de compte Cloudflare : public (il apparaît dans les URL du tableau de
# bord), ce n'est pas un secret. Surchargeable pour un autre compte.
account_id="${R2_ACCOUNT_ID:-3f970202c154a52e46be47cfbd031e13}"
BASE_DIR="/opt/deepsight"
REPO_DIR="${REPO_DIR:-$BASE_DIR/repo}"
RCLONE_CONF="$BASE_DIR/rclone.conf"
BACKUP_ENV="$BASE_DIR/backup.env"
R2_REMOTE="deepsight-r2"
CRYPT_REMOTE="deepsight-crypt"
REMOTE_KEEP_DAYS=30

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

force=0
existing_passphrase=0
for arg in "$@"; do
  case "$arg" in
    --force) force=1 ;;
    --existing-passphrase) existing_passphrase=1 ;;
    *) die "Option inconnue : $arg" ;;
  esac
done

[[ $EUID -ne 0 ]] || die "Lance ce script en tant que deploy (pas en root ni avec sudo)."
[[ -d "$BASE_DIR" && -w "$BASE_DIR" ]] || die "$BASE_DIR absent ou non modifiable : lancer bootstrap.sh d'abord."
if [[ -f "$RCLONE_CONF" && $force -eq 0 ]]; then
  die "Déjà configuré ($RCLONE_CONF). Relance avec --force pour remplacer la configuration."
fi

# ─── 1. rclone ─────────────────────────────────────────────────────────────────
if ! command -v rclone >/dev/null 2>&1; then
  log "Installation de rclone"
  sudo apt-get update -q
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -q rclone
fi

# ─── 2. Identifiants R2 ────────────────────────────────────────────────────────
[[ "$account_id" =~ ^[0-9a-f]{32}$ ]] || die "R2_ACCOUNT_ID invalide : 32 caractères hexadécimaux attendus."
log "Clés du jeton R2 (bucket $BUCKET, juridiction UE)"
cat <<'EOF'
Colle les deux valeurs du jeton, dans n'importe quel ordre :
  - Access Key ID     (32 caractères)
  - Secret Access Key (64 caractères)
Rien ne s'affiche pendant la saisie : colle une valeur, appuie sur Entrée, puis la suivante.
EOF
access_key=""
secret_key=""
for n in 1 2; do
  read -r -s -p "Valeur $n/2 : " value
  echo
  value="${value//[[:space:]]/}"
  if [[ "$value" =~ ^[0-9a-f]{32}$ ]]; then
    [[ "$value" != "$account_id" ]] \
      || die "C'est l'ID de compte, pas une clé du jeton. Reprends « Access Key ID » sur la page du jeton."
    access_key="$value"
  elif [[ "$value" =~ ^[0-9a-f]{64}$ ]]; then
    secret_key="$value"
  else
    die "Valeur non reconnue (${#value} caractères) : il faut l'Access Key ID (32) ou le Secret Access Key (64), pas « Token value »."
  fi
done
[[ -n "$access_key" && -n "$secret_key" ]] \
  || die "Il faut une valeur de 32 caractères ET une de 64 : tu as collé deux fois la même sorte de clé."
echo "Access Key ID et Secret Access Key reconnus."

# ─── 3. Phrase secrète de chiffrement ──────────────────────────────────────────
if [[ $existing_passphrase -eq 1 ]]; then
  read -r -s -p "Phrase secrète existante (saisie invisible) : " passphrase
  echo
  [[ -n "$passphrase" ]] || die "Phrase secrète vide."
else
  passphrase="$(openssl rand -base64 33 | tr -d '\n')"
fi
obscured="$(printf '%s' "$passphrase" | rclone obscure -)"
# Garde-fou : la config doit contenir exactement la phrase affichée.
[[ "$(rclone reveal "$obscured")" == "$passphrase" ]] \
  || die "rclone n'a pas encodé la phrase secrète correctement (version trop ancienne ?)."

# ─── 4. Configuration ──────────────────────────────────────────────────────────
log "Écriture de $RCLONE_CONF"
umask 077
tmp_conf="$(mktemp "$BASE_DIR/.rclone.conf.XXXXXX")"
trap 'rm -f "$tmp_conf"' EXIT
cat > "$tmp_conf" <<CONF
[$R2_REMOTE]
type = s3
provider = Cloudflare
access_key_id = $access_key
secret_access_key = $secret_key
region = auto
endpoint = https://$account_id.eu.r2.cloudflarestorage.com
acl = private
no_check_bucket = true

[$CRYPT_REMOTE]
type = crypt
remote = $R2_REMOTE:$BUCKET
password = $obscured
filename_encryption = standard
directory_name_encryption = true
CONF
export RCLONE_CONFIG="$tmp_conf"

log "Test d'accès au bucket"
rclone lsf "$R2_REMOTE:$BUCKET" --max-depth 1 >/dev/null \
  || die "Accès refusé au bucket $BUCKET. Vérifie le jeton (Object Read & Write, limité à ce bucket) et que le bucket est bien en juridiction UE."

if [[ $existing_passphrase -eq 0 ]]; then
  cat <<EOF

════════════════════ PHRASE SECRÈTE DE CHIFFREMENT ════════════════════

  $passphrase

  Enregistre-la MAINTENANT dans ton gestionnaire de mots de passe, avec la
  mention « DeepSight — sauvegardes R2 ». Ne la colle dans aucune conversation.
  Sans elle, les copies sur R2 sont définitivement illisibles si ce serveur
  est perdu.
═══════════════════════════════════════════════════════════════════════

EOF
  read -r -p "Tape OUI quand la phrase est enregistrée : " confirmation
  [[ "$confirmation" == "OUI" ]] || die "Configuration abandonnée : rien n'a été activé. Relance le script."
fi

mv "$tmp_conf" "$RCLONE_CONF"
trap - EXIT
chmod 600 "$RCLONE_CONF"
export RCLONE_CONFIG="$RCLONE_CONF"

log "Écriture de $BACKUP_ENV"
cat > "$BACKUP_ENV" <<ENV
# Généré par setup-offsite-backup.sh : copie chiffrée vers Cloudflare R2 (UE).
# Lu par backup.sh à chaque sauvegarde.
export RCLONE_CONFIG=$RCLONE_CONF
RCLONE_REMOTE=$CRYPT_REMOTE:
REMOTE_KEEP_DAYS=$REMOTE_KEEP_DAYS
ENV
chmod 600 "$BACKUP_ENV"

# ─── 5. Sauvegarde de test ─────────────────────────────────────────────────────
log "Sauvegarde de test"
"$REPO_DIR/deploy/vps/scripts/backup.sh"

latest="$(find "$BASE_DIR/backups" -maxdepth 1 -name 'deepsight_*.dump' -printf '%T@ %f\n' | sort -n | tail -1 | cut -d' ' -f2)"
[[ -n "$latest" ]] || die "Aucun dump local trouvé après la sauvegarde de test."
remote_size="$(rclone lsf "$CRYPT_REMOTE:" --include "$latest" --format s)"
local_size="$(stat -c %s "$BASE_DIR/backups/$latest")"
[[ "$remote_size" == "$local_size" ]] \
  || die "La copie distante de $latest ne correspond pas (local $local_size o, R2 ${remote_size:-absent})."

log "Copie hors serveur active"
cat <<EOF
  $latest est sur R2, chiffré, et relisible avec ta phrase secrète.
  Chaque nuit à 03h17 : dump vérifié, copie chiffrée sur R2, copies de plus de
  $REMOTE_KEEP_DAYS jours supprimées de R2 (14 jours sur le serveur).

  Lister les copies distantes : RCLONE_CONFIG=$RCLONE_CONF rclone lsl $CRYPT_REMOTE:
EOF
