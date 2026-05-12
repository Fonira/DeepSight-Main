"""Script — configure le webhook Telegram pour @testagentiagudbot.

Usage :
    cd backend
    python scripts/setup_telegram_webhook.py --url https://api.deepsightsynthesis.com
    python scripts/setup_telegram_webhook.py --delete

Vars d'environnement requises :
    TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET

Le script lit `.env` à la racine du backend si présent, sinon les vars système.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import secrets
import sys
from pathlib import Path


def _load_env_file() -> None:
    """Charge backend/.env si présent (sans dépendre de python-dotenv)."""
    backend_root = Path(__file__).resolve().parent.parent
    env_path = backend_root / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


async def main() -> int:
    _load_env_file()

    parser = argparse.ArgumentParser(description="Configure Telegram webhook for DeepSight prospection bot")
    parser.add_argument(
        "--url",
        default=os.environ.get("API_PUBLIC_URL", "https://api.deepsightsynthesis.com"),
        help="Base URL of the FastAPI backend (without trailing slash).",
    )
    parser.add_argument(
        "--path",
        default="/api/bots/telegram/webhook",
        help="Webhook path (default: /api/bots/telegram/webhook).",
    )
    parser.add_argument(
        "--delete",
        action="store_true",
        help="Delete the webhook instead of setting it (drops pending updates).",
    )
    parser.add_argument(
        "--generate-secret",
        action="store_true",
        help="Generate a fresh 32-byte secret instead of reading TELEGRAM_WEBHOOK_SECRET.",
    )
    parser.add_argument(
        "--token",
        default=None,
        help="Override TELEGRAM_BOT_TOKEN (otherwise read from env).",
    )
    args = parser.parse_args()

    token = args.token or os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        print("❌ TELEGRAM_BOT_TOKEN missing (env or --token).", file=sys.stderr)
        return 1

    os.environ["TELEGRAM_BOT_TOKEN"] = token

    # Import après injection env pour que `bot_settings` lise la bonne valeur
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
    from bots.telegram.adapter import delete_webhook, set_webhook  # noqa: E402

    if args.delete:
        print("→ deleteWebhook...")
        result = await delete_webhook()
        print(result)
        return 0 if result.get("ok") else 2

    webhook_url = f"{args.url.rstrip('/')}{args.path}"
    secret = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
    if args.generate_secret or not secret:
        secret = secrets.token_urlsafe(32)
        print("🔑 Generated TELEGRAM_WEBHOOK_SECRET (ajoute-la à .env.production) :")
        print(f"    TELEGRAM_WEBHOOK_SECRET={secret}")
        print()
    os.environ["TELEGRAM_WEBHOOK_SECRET"] = secret

    print(f"→ setWebhook url={webhook_url}")
    result = await set_webhook(webhook_url=webhook_url, secret_token=secret)
    print(result)
    return 0 if result.get("ok") else 2


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
