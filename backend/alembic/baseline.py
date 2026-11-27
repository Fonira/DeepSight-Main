"""Détecte une base construite par `create_all` mais inconnue d'Alembic.

Utilisé par entrypoint.sh avant `alembic upgrade heads`.

Contexte : sur une base neuve, la chaîne de migrations échoue tôt (006 modifie
`shared_analyses`, qu'aucune migration antérieure ne crée). Postgres annule tout
l'upgrade, puis l'app construit le schéma avec `Base.metadata.create_all`.
Aux démarrages suivants, alembic repartait de zéro et échouait encore
(DuplicateColumn dès 002) : aucune migration n'était jamais appliquée.

Si les tables de l'app existent (`users`) mais qu'alembic_version est vide ou
absente, le schéma correspond aux modèles actuels : on marque la base au
niveau BASELINE_REVISIONS (alembic stamp), et les migrations postérieures
s'appliquent normalement ensuite.

Code de sortie : 0 = stamp nécessaire, 1 = rien à faire, 2 = erreur (on
laisse alors l'upgrade normal se dérouler).
"""

import os
import sys

from sqlalchemy import create_engine, text

# Dernières révisions dont le contenu est couvert par les modèles SQLAlchemy
# (donc par create_all). Les migrations suivantes (034+) créent ce que
# create_all ne crée pas : elles doivent tourner après le stamp.
BASELINE_REVISIONS = ("033_decodo_scraping_usage", "033_user_sessions")


SYNC_DRIVER_PREFIX = "postgresql+psycopg2://"


def _sync_url(url: str | None = None) -> str:
    """URL synchrone pour psycopg2, comme alembic/env.py.

    Le driver est explicite : depuis SQLAlchemy 2.1, « postgresql:// » charge
    psycopg (v3), qui n'est pas installé (seul psycopg2-binary l'est).
    """
    if url is None:
        url = os.environ.get("DATABASE_URL", "")
    if "?" in url:
        base, params = url.split("?", 1)
        params = "&".join(p for p in params.split("&") if not p.startswith(("sslmode=", "ssl=")))
        url = base + ("?" + params if params else "")
    for prefix in ("postgresql+asyncpg://", "postgres://", "postgresql://"):
        if url.startswith(prefix):
            return SYNC_DRIVER_PREFIX + url[len(prefix) :]
    return url


def needs_baseline() -> bool:
    url = _sync_url()
    if not url.startswith(SYNC_DRIVER_PREFIX):
        return False
    engine = create_engine(url)
    try:
        with engine.connect() as conn:
            has_users = conn.execute(text("SELECT to_regclass('public.users') IS NOT NULL")).scalar()
            if not has_users:
                return False
            has_version_table = conn.execute(text("SELECT to_regclass('public.alembic_version') IS NOT NULL")).scalar()
            if not has_version_table:
                return True
            count = conn.execute(text("SELECT COUNT(*) FROM alembic_version")).scalar()
            return count == 0
    finally:
        engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--revisions":
        print(" ".join(BASELINE_REVISIONS))
        sys.exit(0)
    try:
        sys.exit(0 if needs_baseline() else 1)
    except Exception as exc:  # pragma: no cover — diagnostic au démarrage
        # « alembic » dans la ligne : le script de déploiement filtre les logs
        # du conteneur sur ce mot (deploy/vps/scripts/ci-deploy.sh).
        print(f"[baseline] alembic baseline check failed: {exc}", file=sys.stderr)
        sys.exit(2)
