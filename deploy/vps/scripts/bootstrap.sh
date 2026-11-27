#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# DeepSight — préparation d'un VPS neuf (Debian 12/13 ou Ubuntu 24.04 ; netcup ou autre)
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

# Une coupure SSH ne doit pas interrompre l'installation (dpkg resterait à moitié
# configuré) : le script se relance détaché de la session et on suit son journal.
LOG_FILE="/var/log/deepsight-bootstrap.log"
if [[ -z "${DS_BOOTSTRAP_CHILD:-}" ]]; then
  : > "$LOG_FILE"
  DS_BOOTSTRAP_CHILD=1 setsid nohup bash "$0" "$@" > "$LOG_FILE" 2>&1 < /dev/null &
  child=$!
  printf 'Installation lancée en arrière-plan : elle continue même si SSH coupe.\n'
  printf 'Pour la suivre après une reconnexion : tail -f %s\n' "$LOG_FILE"
  tail -n +1 -f --pid="$child" "$LOG_FILE" || true
  wait "$child"
  exit $?
fi

export DEBIAN_FRONTEND=noninteractive

# IP de la session SSH qui lance le script. fail2ban lit le journal dès son
# installation : sans exception, des essais de mot de passe ratés juste avant
# (clé pas encore posée) font bannir l'administrateur en pleine installation.
ADMIN_IP="${SSH_CLIENT:-}"
ADMIN_IP="${ADMIN_IP%% *}"
[[ "$ADMIN_IP" =~ ^[0-9A-Fa-f.:]+$ ]] || ADMIN_IP=""

write_fail2ban_jail() {
  install -d -m 755 /etc/fail2ban/jail.d
  cat > /etc/fail2ban/jail.d/10-deepsight.conf <<CONF
[DEFAULT]
ignoreip = 127.0.0.1/8 ::1${ADMIN_IP:+ $ADMIN_IP}

# Debian n'écrit plus /var/log/auth.log : fail2ban lit le journal systemd.
[sshd]
enabled = true
backend = systemd
CONF
}

# Debian (image netcup par défaut) et Ubuntu sont pris en charge.
# shellcheck disable=SC1091
. /etc/os-release
case "${ID:-}" in
  debian|ubuntu) OS_ID="$ID" ;;
  *) die "Système non pris en charge : ${PRETTY_NAME:-inconnu} (Debian 12/13 ou Ubuntu 24.04 attendus)" ;;
esac
OS_CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
[[ -n "$OS_CODENAME" ]] || die "Nom de version introuvable dans /etc/os-release"
log "Système détecté : ${PRETTY_NAME:-$OS_ID $OS_CODENAME}"

# ─── 1. Utilisateur de déploiement ─────────────────────────────────────────────
# Les images minimales Debian n'ont pas sudo.
if ! command -v visudo >/dev/null 2>&1; then
  log "Installation de sudo"
  apt-get update -q
  apt-get install -y -q sudo
fi

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
# Écrit avant l'installation : fail2ban démarre déjà avec l'exception.
write_fail2ban_jail
apt-get install -y -q ca-certificates curl git rsync ufw fail2ban python3-systemd unattended-upgrades openssl sudo
dpkg-reconfigure -f noninteractive unattended-upgrades

# ─── 3. Docker ─────────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "Installation de Docker (dépôt officiel)"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$OS_ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$OS_ID $OS_CODENAME stable" \
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
ufw allow 22/tcp >/dev/null
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
write_fail2ban_jail
systemctl enable fail2ban >/dev/null 2>&1 || true
systemctl restart fail2ban || warn "fail2ban n'a pas démarré (voir : journalctl -u fail2ban)"
if [[ -n "$ADMIN_IP" ]]; then
  log "fail2ban : $ADMIN_IP (ta connexion actuelle) ne sera jamais bannie"
  fail2ban-client unban "$ADMIN_IP" >/dev/null 2>&1 || true
fi

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
