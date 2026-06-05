#!/usr/bin/env bash
# =============================================================================
# diagnose_openclaw_bots.sh
# -----------------------------------------------------------------------------
# Diagnostic + réparation des bots Telegram OpenClaw (Bobby, Alfred) et de
# l'agent Kimi, quand "les bots ne répondent plus".
#
# À EXÉCUTER SUR LE VPS Hetzner (clawdbot), en root :
#   ssh -i ~/.ssh/id_hetzner root@89.167.23.214 'bash -s' < scripts/diagnose_openclaw_bots.sh
# ou copier le fichier puis : bash diagnose_openclaw_bots.sh
#
# Par défaut : DIAGNOSTIC SEUL (aucune modification).
# Pour autoriser le redémarrage automatique du service :  RESTART=1 bash ...
# =============================================================================
set -uo pipefail

RESTART="${RESTART:-0}"
OPENCLAW_DIR="${OPENCLAW_DIR:-/root/.openclaw}"
CONFIG="${OPENCLAW_CONFIG:-$OPENCLAW_DIR/openclaw.json}"
hr() { printf '\n\033[1;36m──── %s ────\033[0m\n' "$1"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
ko() { printf '  \033[31m✗\033[0m %s\n' "$1"; }
note() { printf '  \033[33m•\033[0m %s\n' "$1"; }

hr "0. Contexte machine"
note "host=$(hostname)  date=$(date -u +%FT%TZ)"
note "uptime: $(uptime -p 2>/dev/null || uptime)"
echo "  disque /:"; df -h / | sed 's/^/    /'
echo "  RAM:";      free -m | sed 's/^/    /'
DISK_USE=$(df --output=pcent / | tail -1 | tr -dc '0-9')
[ "${DISK_USE:-0}" -ge 95 ] && ko "DISQUE PLEIN (${DISK_USE}%) — cause fréquente de crash bot" || ok "disque OK (${DISK_USE}%)"

hr "1. Comment tourne OpenClaw ?"
RUNNER="unknown"
if command -v systemctl >/dev/null && systemctl list-units --type=service --all 2>/dev/null | grep -qi openclaw; then
  RUNNER="systemd"; SVC=$(systemctl list-units --type=service --all | grep -io '[a-z0-9_.-]*openclaw[a-z0-9_.-]*\.service' | head -1)
  ok "systemd: $SVC"; systemctl status "$SVC" --no-pager -l 2>&1 | head -15 | sed 's/^/    /'
elif command -v docker >/dev/null && docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qi openclaw; then
  RUNNER="docker"; CNAME=$(docker ps -a --format '{{.Names}}' | grep -i openclaw | head -1)
  ok "docker: $CNAME"; docker ps -a --filter "name=$CNAME" --format '    {{.Names}} | {{.Status}} | {{.Image}}'
elif command -v pm2 >/dev/null && pm2 list 2>/dev/null | grep -qi openclaw; then
  RUNNER="pm2"; ok "pm2"; pm2 list 2>/dev/null | grep -i openclaw | sed 's/^/    /'
elif pgrep -af -i openclaw >/dev/null 2>&1; then
  RUNNER="process"; ok "process nu (pas de superviseur)"; pgrep -af -i openclaw | sed 's/^/    /'
else
  ko "AUCUN process/service OpenClaw détecté → le bot est DOWN"
fi
note "runner=$RUNNER"

hr "2. Logs récents (erreurs)"
case "$RUNNER" in
  systemd) journalctl -u "$SVC" -n 80 --no-pager 2>/dev/null | grep -iE 'error|exception|conflict|401|403|409|unauthorized|traceback|panic|fatal' | tail -25 | sed 's/^/    /' || note "pas d'erreur évidente";;
  docker)  docker logs --tail 120 "$CNAME" 2>&1 | grep -iE 'error|exception|conflict|401|403|409|unauthorized|traceback|panic|fatal' | tail -25 | sed 's/^/    /' || note "pas d'erreur évidente";;
  pm2)     pm2 logs --nostream --lines 120 2>/dev/null | grep -iE 'error|conflict|401|403|409|unauthorized|fatal' | tail -25 | sed 's/^/    /' || note "voir ~/.pm2/logs";;
  *)       for f in "$OPENCLAW_DIR"/*.log /var/log/openclaw*.log; do [ -f "$f" ] && { note "log: $f"; tail -40 "$f" | grep -iE 'error|conflict|401|403|409|unauthorized|fatal' | sed 's/^/    /'; }; done;;
esac

hr "3. Validité des tokens Telegram (getMe + getWebhookInfo)"
# Extrait les tokens depuis la config OpenClaw sans les afficher en clair.
if [ ! -f "$CONFIG" ]; then
  ko "Config introuvable: $CONFIG (ajuste OPENCLAW_CONFIG=...)"
else
  ok "config: $CONFIG"
  # Récupère toutes les chaînes ressemblant à un token bot (digits:alnum) dans la config.
  mapfile -t TOKENS < <(grep -oE '[0-9]{6,12}:[A-Za-z0-9_-]{30,}' "$CONFIG" | sort -u)
  if [ "${#TOKENS[@]}" -eq 0 ]; then
    ko "Aucun token Telegram trouvé dans la config (structure différente ? grep manuel requis)"
  fi
  for T in "${TOKENS[@]}"; do
    ID="${T%%:*}"
    GM=$(curl -s -m 10 "https://api.telegram.org/bot${T}/getMe")
    if echo "$GM" | grep -q '"ok":true'; then
      UN=$(echo "$GM" | grep -oE '"username":"[^"]+"' | head -1 | cut -d'"' -f4)
      ok "bot id=$ID  @${UN}  token VALIDE"
      WH=$(curl -s -m 10 "https://api.telegram.org/bot${T}/getWebhookInfo")
      WURL=$(echo "$WH" | grep -oE '"url":"[^"]*"' | head -1 | cut -d'"' -f4)
      PEND=$(echo "$WH" | grep -oE '"pending_update_count":[0-9]+' | head -1 | cut -d: -f2)
      LASTERR=$(echo "$WH" | grep -oE '"last_error_message":"[^"]*"' | head -1 | cut -d'"' -f4)
      if [ -n "$WURL" ]; then
        note "@${UN}: webhook ACTIF → $WURL  (pending=$PEND)"
        note "  ⚠ si OpenClaw fait du LONG POLLING, ce webhook provoque un 409 Conflict → deleteWebhook requis"
      else
        note "@${UN}: pas de webhook (mode polling)  pending=${PEND:-0}"
      fi
      [ -n "$LASTERR" ] && ko "@${UN}: last_error Telegram = $LASTERR"
    else
      DESC=$(echo "$GM" | grep -oE '"description":"[^"]*"' | cut -d'"' -f4)
      ko "bot id=$ID  token INVALIDE/RÉVOQUÉ → $DESC  (régénérer via @BotFather)"
    fi
  done
fi

hr "4. Connectivité sortante Telegram"
curl -s -m 10 -o /dev/null -w "    api.telegram.org → HTTP %{http_code}\n" https://api.telegram.org/ || ko "Telegram injoignable depuis le VPS (firewall/DNS ?)"

hr "5. Agent Kimi"
if pgrep -af -i kimi >/dev/null 2>&1; then ok "process kimi détecté"; pgrep -af -i kimi | sed 's/^/    /'
else note "pas de process 'kimi' isolé (souvent intégré à OpenClaw — vérifier la clé API Moonshot/Kimi dans $CONFIG)"; fi
grep -iqE 'kimi|moonshot' "$CONFIG" 2>/dev/null && ok "réf Kimi/Moonshot présente dans la config" || note "aucune réf Kimi dans la config"

hr "6. Réparation"
if [ "$RESTART" != "1" ]; then
  note "DIAGNOSTIC SEUL. Pour redémarrer : relance avec  RESTART=1"
  case "$RUNNER" in
    systemd) note "manuel: systemctl restart $SVC";;
    docker)  note "manuel: docker restart $CNAME";;
    pm2)     note "manuel: pm2 restart openclaw  (ou: pm2 resurrect)";;
    *)       note "manuel: relancer le binaire openclaw (voir doc OpenClaw)";;
  esac
else
  case "$RUNNER" in
    systemd) systemctl restart "$SVC" && ok "restart systemd OK" && sleep 3 && systemctl is-active "$SVC";;
    docker)  docker restart "$CNAME" && ok "restart docker OK" && sleep 3 && docker ps --filter "name=$CNAME" --format '    {{.Status}}';;
    pm2)     pm2 restart all && ok "restart pm2 OK";;
    *)       ko "Runner inconnu — redémarrage manuel requis";;
  esac
fi

hr "Fin"
echo "  Causes les plus fréquentes (bots muets) :"
echo "    1) service OpenClaw down (crash/OOM/reboot)        → §1/§6 restart"
echo "    2) token révoqué (401)                             → §3, régénérer @BotFather + maj $CONFIG"
echo "    3) webhook fantôme vs polling → 409 Conflict       → §3, deleteWebhook"
echo "    4) disque plein                                    → §0, purger logs"
echo "    5) Telegram bloqué en sortie (firewall)            → §4"
