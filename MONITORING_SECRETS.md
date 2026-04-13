# DeepSight — Secrets GitHub pour les Smoke Tests

Les workflows `smoke-tests.yml` et `smoke-on-deploy.yml` requierent les secrets suivants dans **Settings > Secrets and variables > Actions** du repo GitHub.

## Secrets a configurer

| Secret                | Description                                              | Comment l'obtenir                                                                                          |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `API_BASE_URL`        | URL de l'API backend production                          | `https://api.deepsightsynthesis.com`                                                                       |
| `HEALTH_CHECK_SECRET` | Secret pour le deep health check (`/api/v1/health/deep`) | Generer un token aleatoire : `openssl rand -hex 32` puis l'ajouter aussi dans `.env.production` sur le VPS |
| `TELEGRAM_BOT_TOKEN`  | Token du bot Telegram @Fonirabot                         | Depuis @BotFather sur Telegram : `/mybots` > selectionner @Fonirabot > API Token                           |
| `TELEGRAM_CHAT_ID`    | ID du chat/groupe pour les alertes                       | Voir la procedure ci-dessous                                                                               |

## Obtenir le Telegram Chat ID

1. Envoyer un message au bot @Fonirabot sur Telegram (ou l'ajouter dans un groupe)
2. Appeler l'API getUpdates :

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates" | jq '.result[-1].message.chat.id'
```

3. Pour un groupe, le chat_id est negatif (ex: `-1001234567890`)
4. Pour un chat prive, c'est un nombre positif (ex: `123456789`)

## Verification

Apres configuration, tester manuellement :

```bash
# Test notification Telegram
curl -s -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d chat_id="<CHAT_ID>" \
  -d text="Test notification DeepSight"

# Test deep health check
curl "https://api.deepsightsynthesis.com/api/v1/health/deep?secret=<HEALTH_CHECK_SECRET>"
```

## Declenchement manuel

Le workflow `Smoke Tests` peut etre lance manuellement depuis l'onglet Actions du repo GitHub avec l'option `Run workflow`.
