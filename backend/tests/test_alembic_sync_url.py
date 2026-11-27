"""URL synchrone d'Alembic : le driver psycopg2 doit être explicite.

Depuis SQLAlchemy 2.1, « postgresql:// » charge psycopg (v3), qui n'est pas
installé : alembic échouait dans create_engine au démarrage du conteneur et
aucune migration ne tournait.
"""

import importlib.util
from pathlib import Path

import pytest
from sqlalchemy import create_engine, pool

BASELINE_PATH = Path(__file__).resolve().parents[1] / "alembic" / "baseline.py"


def _load_baseline():
    # Chargement par chemin : le dossier backend/alembic masquerait le paquet alembic.
    spec = importlib.util.spec_from_file_location("deepsight_alembic_baseline", BASELINE_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


baseline = _load_baseline()


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (
            "postgresql+asyncpg://deepsight:pw@postgres:5432/deepsight",
            "postgresql+psycopg2://deepsight:pw@postgres:5432/deepsight",
        ),
        (
            "postgres://deepsight:pw@postgres:5432/deepsight",
            "postgresql+psycopg2://deepsight:pw@postgres:5432/deepsight",
        ),
        (
            "postgresql://deepsight:pw@postgres:5432/deepsight",
            "postgresql+psycopg2://deepsight:pw@postgres:5432/deepsight",
        ),
        (
            "postgresql+asyncpg://u:pw@h:5432/db?sslmode=require&application_name=api",
            "postgresql+psycopg2://u:pw@h:5432/db?application_name=api",
        ),
        ("sqlite+aiosqlite:///./test.db", "sqlite+aiosqlite:///./test.db"),
        ("", ""),
    ],
)
def test_sync_url_forces_psycopg2(raw: str, expected: str) -> None:
    assert baseline._sync_url(raw) == expected


def test_sync_url_builds_a_psycopg2_engine() -> None:
    url = baseline._sync_url("postgresql+asyncpg://deepsight:pw@postgres:5432/deepsight")
    engine = create_engine(url, poolclass=pool.NullPool)
    try:
        assert engine.dialect.driver == "psycopg2"
    finally:
        engine.dispose()


def test_env_py_uses_the_same_driver() -> None:
    env_source = (BASELINE_PATH.parent / "env.py").read_text(encoding="utf-8")
    assert '"postgresql+psycopg2://"' in env_source
    assert 'url.replace("postgresql+asyncpg://", "postgresql://")' not in env_source


def test_needs_baseline_skips_non_postgres(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    assert baseline.needs_baseline() is False
