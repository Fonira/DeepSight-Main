#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# DeepSight — clé SSH dédiée au déploiement depuis GitHub Actions
#
# À lancer sur le serveur, en tant qu'utilisateur deploy :
#   setup-ci-deploy.sh install          crée la clé et l'autorise, limitée à
#                                       ci-deploy.sh (aucun shell possible)
#   setup-ci-deploy.sh known-hosts      affiche la ligne known_hosts du serveur
#   setup-ci-deploy.sh private-key      affiche la clé privée PUIS la supprime
#                                       du serveur (à envoyer dans un secret GitHub)
#   setup-ci-deploy.sh revoke           retire la clé et sa commande forcée
#
# Depuis le PC (cmd), sans jamais afficher la clé :
#   ssh ... "bash .../setup-ci-deploy.sh private-key" | gh secret set VPS_DEPLOY_KEY --repo Fonira/DeepSight-Main
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/deepsight/repo}"
KEY_FILE="$HOME/.ssh/deepsight_ci"
GATE="$HOME/bin/deepsight-ci-deploy.sh"
AUTH_KEYS="$HOME/.ssh/authorized_keys"
MARKER="github-actions-deploy@deepsight"
HOST="${CI_SSH_HOST:-62.83.136.156}"

die() { printf '[x] %s\n' "$*" >&2; exit 1; }

remove_entry() {
  [[ -f "$AUTH_KEYS" ]] || return 0
  local tmp
  tmp="$(mktemp)"
  grep -v -F "$MARKER" "$AUTH_KEYS" >"$tmp" || true
  cat "$tmp" >"$AUTH_KEYS"
  rm -f "$tmp"
}

case "${1:-}" in
  install)
    [[ "$(id -un)" != "root" ]] || die "À lancer en tant que deploy, pas root"
    mkdir -p "$HOME/.ssh" "$HOME/bin"
    chmod 700 "$HOME/.ssh"

    # Copie figée de la commande forcée : déployer une branche ne la modifie pas.
    install -m 755 "$REPO_DIR/deploy/vps/scripts/ci-deploy.sh" "$GATE"

    if [[ ! -f "$KEY_FILE.pub" ]]; then
      ssh-keygen -q -t ed25519 -N "" -C "$MARKER" -f "$KEY_FILE"
    fi

    remove_entry
    touch "$AUTH_KEYS"
    chmod 600 "$AUTH_KEYS"
    # restrict : ni redirection de port, ni agent, ni pty ; command= : seul le script tourne.
    printf 'restrict,command="%s" %s\n' "$GATE" "$(cat "$KEY_FILE.pub")" >>"$AUTH_KEYS"

    echo "Clé de déploiement installée (commande forcée : $GATE)."
    if [[ -f "$KEY_FILE" ]]; then
      echo "Étape suivante : envoyer la clé privée dans le secret GitHub VPS_DEPLOY_KEY (sous-commande private-key)."
    fi
    ;;

  known-hosts)
    for f in /etc/ssh/ssh_host_ed25519_key.pub /etc/ssh/ssh_host_ecdsa_key.pub /etc/ssh/ssh_host_rsa_key.pub; do
      if [[ -r "$f" ]]; then
        awk -v h="$HOST" '{print h, $1, $2}' "$f"
      fi
    done
    ;;

  private-key)
    [[ -f "$KEY_FILE" ]] || die "Pas de clé privée sur le serveur (déjà envoyée et supprimée ? relancer install après revoke)"
    cat "$KEY_FILE"
    # La clé ne doit vivre que dans le secret GitHub.
    shred -u "$KEY_FILE" 2>/dev/null || rm -f "$KEY_FILE"
    ;;

  revoke)
    remove_entry
    rm -f "$KEY_FILE" "$KEY_FILE.pub" "$GATE"
    echo "Clé de déploiement GitHub Actions révoquée."
    ;;

  *)
    sed -n '3,15p' "$0"
    exit 2
    ;;
esac
