#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# DeepSight — point d'entrée unique de la clé SSH de GitHub Actions
#
# Ce script n'est pas appelé directement : setup-ci-deploy.sh en installe une
# copie dans ~/bin et l'impose comme « command= » de la clé de déploiement dans
# ~/.ssh/authorized_keys. Quoi que demande la connexion SSH, seul ce script
# s'exécute, avec la commande demandée dans SSH_ORIGINAL_COMMAND.
#
# Commandes acceptées :
#   deploy <branche>   redéploie la branche (deploy.sh), puis affiche l'état
#                      des migrations et des conteneurs
#   status             état des conteneurs, santé de l'API, lignes migrations
#
# La copie dans ~/bin ne change pas quand on déploie une branche : la modifier
# demande de relancer « setup-ci-deploy.sh install » sur le serveur.
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/deepsight/repo}"

print_status() {
  echo
  echo "==> Conteneurs"
  docker ps --format '{{.Names}}\t{{.Status}}' | sort
  echo
  echo "==> Migrations (logs entrypoint de l'API)"
  docker logs repo-backend-1 2>&1 | grep -E '\[entrypoint\]|alembic' | tail -20 || true
  echo
  echo "==> Santé de l'API"
  docker exec repo-backend-1 curl -fsS http://localhost:8080/health || echo "(health indisponible)"
  echo
}

read -r action arg extra <<<"${SSH_ORIGINAL_COMMAND:-}"

case "${action:-}" in
  deploy)
    if [[ -z "${arg:-}" || -n "${extra:-}" ]]; then
      echo "usage : deploy <branche>" >&2
      exit 2
    fi
    # Noms de branche simples uniquement : pas d'option, pas de « .. », pas d'espace.
    if [[ ! "$arg" =~ ^[A-Za-z0-9._/-]{1,100}$ || "$arg" == -* || "$arg" == *..* ]]; then
      echo "branche refusée : $arg" >&2
      exit 2
    fi
    "$REPO_DIR/deploy/vps/scripts/deploy.sh" "$arg"
    print_status
    ;;
  status)
    print_status
    ;;
  *)
    echo "commande refusée : « ${SSH_ORIGINAL_COMMAND:-} » (accepte : deploy <branche>, status)" >&2
    exit 2
    ;;
esac
