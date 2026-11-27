"""
Alembic environment configuration for DeepSight.

Supports both:
- Online mode: direct connection to PostgreSQL (production)
- Offline mode: generate SQL scripts without DB connection
"""

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool, create_engine

# Add src/ to path so we can import our models
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from db.database import Base  # noqa: E402

# Alembic Config object
config = context.config

# Setup Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = Base.metadata


def get_database_url() -> str:
    """
    Resolve the database URL for migrations.

    Priority:
    1. DATABASE_URL env var (Railway sets this)
    2. alembic.ini sqlalchemy.url (local dev fallback)

    Converts async drivers to sync for Alembic compatibility:
    - postgresql+asyncpg:// → postgresql+psycopg2://
    """
    url = os.environ.get("DATABASE_URL", "")

    if not url:
        url = config.get_main_option("sqlalchemy.url", "")

    # Strip SSL params (psycopg2 handles them differently)
    if "?" in url:
        base, params = url.split("?", 1)
        params = "&".join(
            p for p in params.split("&")
            if not p.startswith("sslmode=") and not p.startswith("ssl=")
        )
        url = base + ("?" + params if params else "")

    # Convert to sync driver for Alembic. Le driver est explicite : depuis
    # SQLAlchemy 2.1, « postgresql:// » charge psycopg (v3), absent de l'image
    # (seul psycopg2-binary est dans requirements.txt) et create_engine échoue.
    url = url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    url = url.replace("postgres://", "postgresql+psycopg2://")
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    # SQLite async (aiosqlite) → sync driver for Alembic
    url = url.replace("sqlite+aiosqlite://", "sqlite://")

    return url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — generates SQL without a live connection."""
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode — connects to the database."""
    url = get_database_url()

    # SSL for Railway proxy
    connect_args = {}
    if ".proxy.rlwy.net" in url:
        import ssl
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        connect_args["sslmode"] = "require"

    connectable = create_engine(
        url,
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    with connectable.connect() as connection:
        if connection.dialect.name == "postgresql":
            # Par défaut alembic crée version_num en VARCHAR(32), trop court pour
            # certains IDs (006, 016, 023 > 32 caractères) : l'upgrade échouait
            # sur une base neuve. On fixe la taille AVANT que alembic ne crée la table.
            connection.exec_driver_sql(
                "CREATE TABLE IF NOT EXISTS alembic_version ("
                "version_num VARCHAR(255) NOT NULL, "
                "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))"
            )
            connection.exec_driver_sql("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(255)")
            connection.commit()

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
