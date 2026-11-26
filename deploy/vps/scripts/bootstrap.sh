#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# DeepSight — préparation d'un VPS neuf (Ubuntu 24.04 ; netcup ou autre)
#
# À lancer UNE fois, en root (netcup) ou avec sudo (images avec utilisateur "ubuntu") :
#   git clone --depth 50 https://github.com/Fonira/DeepSight-Main.git ~/ds-bootstrap
#   bash ~/ds-bootstrap/deploy/vps/scripts/bootstrap.sh        # en root
#   sudo bash ~/ds-bootstrap/deploy/vps/scripts/bootstrap.sh   # depuis un utilisateur sudo
#
# Ce que fait le script (relançable sans risque) :
#   1. utilisateur de déploiement (lancé en root : crée "deploy" avec ta clé SSH)
#   2. mises à jour système + mises à jour de sécurité automatiques
#   3. Docker (dépôt officiel) avec rotation des logs
#   4. 2 Go de swap (le build du site a besoin de mémoire)
#   5. pare-feu UFW : seuls SSH, HTTP et HTTPS sont ouverts
#   6. SSH par clé uniquement, root interdit (si la clé est installée) + fail2ban
#   7. dossiers /opt/deepsight, clone du repo, fichiers .env avec secrets générés
#   8. sauvegarde quotidienne de la base à 03h17
#
# Variables optionnelles : DEPLOY_USER (défaut : utilisateur sudo, sinon "deploy"), BRANCH (défaut : main)
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Fonira/DeepSight-Main.git}"
BRANCH="${BRANCH:-main}"
DEPLOY_USER="${DEPLOY_USER:-${SUDO_USER:-deploy}}"
[[ "$DEPLOY_USER" == "root" ]] && DEPLOY_USER="deploy"
BASE_DIR="/opt/deepsight"
REPO_DIR="$BASE_DIR/repo"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Lancer en root ou avec sudo : sudo bash $0"

export DEBIAN_FRONTEND=noninteractive

# ─── 1. Utilisateur de déploiement ─────────────────────────────────────────────
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  log "Création de l'utilisateur $DEPLOY_USER"
  useradd --create-home --shell /bin/bash --groups sudo "$DEPLOY_USER"
  # Connexion par clé uniquement : pas de mot de passe, sudo sans mot de passe.
  echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$DEPLOY_USER"
  chmod 440 "/etc/sudoers.d/90-$DEPLOY_USER"
  visudo -cf "/etc/sudoers.d/90-$DEPLOY_USER" >/dev/null
fi
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"

# Reprend la clé SSH de root (déposée par l'hébergeur) si l'utilisateur n'en a pas.
if [[ ! -s "$DEPLOY_HOME/.ssh/authorized_keys" && -s /root/.ssh/authorized_keys ]]; then
  log "Copie de ta clé SSH vers $DEPLOY_USER"
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /root/.ssh/authorized_keys "$DEPLOY_HOME/.ssh/authorized_keys"
fi

# ─── 2. Système ────────────────────────────────────────────────────────────────
log "Mise à jour du système"
apt-get update -q
apt-get upgrade -y -q
apt-get install -y -q ca-certificates curl git rsync ufw fail2ban unattended-upgrades openssl
dpkg-reconfigure -f noninteractive unattended-upgrades

# ─── 3. Docker ─────────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "Installation de Docker (dépôt officiel)"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  codename="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $codename stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  log "Docker déjà installé"
fi

if [[ ! -f /etc/docker/daemon.json ]]; then
  log "Rotation des logs Docker (3 × 10 Mo par container)"
  cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
  systemctl restart docker
fi
systemctl enable --now docker
usermod -aG docker "$DEPLOY_USER"

# ─── 4. Swap ───────────────────────────────────────────────────────────────────
if ! swapon --show | grep -q .; then
  log "Création de 2 Go de swap"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo 'vm.swappiness=10' > /etc/sysctl.d/99-deepsight-swap.conf
  sysctl -q -p /etc/sysctl.d/99-deepsight-swap.conf
else
  log "Swap déjà présent"
fi

# ─── 5. Pare-feu ───────────────────────────────────────────────────────────────
log "Pare-feu UFW : SSH, HTTP, HTTPS"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null

# ─── 6. SSH + fail2ban ─────────────────────────────────────────────────────────
auth_keys="$DEPLOY_HOME/.ssh/authorized_keys"
if [[ -s "$auth_keys" ]] && grep -qE '^(ssh-|ecdsa-|sk-)' "$auth_keys"; then
  log "SSH : connexion par clé uniquement, root interdit"
  cat > /etc/ssh/sshd_config.d/10-deepsight.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
CONF
  sshd -t
  # Ubuntu 24.04 active sshd à la demande : rien à recharger s'il ne tourne pas.
  systemctl try-reload-or-restart ssh
else
  warn "Aucune clé SSH dans $auth_keys : connexion par mot de passe laissée active."
  warn "Ajoute ta clé (voir README), puis relance ce script pour verrouiller SSH."
fi
systemctl enable --now fail2ban

# ─── 7. Dossiers, repo, fichiers .env ──────────────────────────────────────────
log "Dossiers $BASE_DIR"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$BASE_DIR" "$BASE_DIR/www" "$BASE_DIR/backups"
for f in cookies.txt tiktok_cookies.txt; do
  [[ -e "$BASE_DIR/$f" ]] || install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /dev/null "$BASE_DIR/$f"
done

if [[ ! -d "$REPO_DIR/.git" ]]; then
  log "Clone du repo ($BRANCH)"
  sudo -u "$DEPLOY_USER" git clone --depth 50 --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
else
  log "Repo déjà présent dans $REPO_DIR"
fi

# Copie un modèle .env et remplace chaque __GENERATE__ par un secret distinct.
make_env() {
  local example="$1" target="$2"
  if [[ -f "$target" ]]; then
    log "$(basename "$target") existe déjà : conservé tel quel"
    return
  fi
  log "Création de $(basename "$target")"
  local tmp
  tmp="$(mktemp)"
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[A-Z0-9_]+=__GENERATE__$ ]]; then
      line="${line%%=*}=$(openssl rand -hex 32)"
    fi
    printf '%s\n' "$line"
  done < "$example" > "$tmp"
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$tmp" "$target"
  rm -f "$tmp"
}
make_env "$REPO_DIR/deploy/vps/env/env.production.example" "$REPO_DIR/.env.production"
make_env "$REPO_DIR/deploy/vps/env/env.frontend.example" "$REPO_DIR/.env.frontend"

# ─── 8. Sauvegarde quotidienne ─────────────────────────────────────────────────
log "Sauvegarde quotidienne de la base (03h17)"
cat > /etc/cron.d/deepsight-backup <<CRON
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 3 * * * $DEPLOY_USER $REPO_DIR/deploy/vps/scripts/backup.sh >> $BASE_DIR/backups/backup.log 2>&1
CRON
chmod 644 /etc/cron.d/deepsight-backup

log "Serveur prêt"
cat <<EOF

Étapes suivantes :
  1. Déconnecte-toi, puis reconnecte-toi en tant que "$DEPLOY_USER" (ssh $DEPLOY_USER@IP_DU_VPS).
     La connexion root par SSH est désormais refusée.
  2. Renseigne tes clés d'API :   nano $REPO_DIR/.env.production
     et l'email admin (ADMIN_EMAIL). Le mot de passe admin généré est dans ce fichier.
  3. Renseigne le site :          nano $REPO_DIR/.env.frontend
  4. Déploie :                    $REPO_DIR/deploy/vps/scripts/deploy.sh

EOF
