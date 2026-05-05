#!/bin/sh
# Container entrypoint — runs alembic migrations before handing off to uvicorn.
#
# WHY: Without this, Base.metadata.create_all() in main.py materialized tables
# at uvicorn startup, then `alembic upgrade head` failed with DuplicateTable on
# subsequent rebuilds — forcing manual `alembic stamp <rev>` per migration
# (cf. sprints Débat IA v1/v2, Pricing v2, Semantic Search). With this script,
# alembic runs FIRST, owns the schema cleanly, and create_all() becomes no-op.
#
# Failure mode: if alembic upgrade fails (e.g. divergent state), the container
# still starts so the API stays up — admin must run `alembic stamp head` or
# fix the migration manually. Health check + auto-rollback in deploy-backend.yml
# protects against runtime regressions.
set -e

echo "[entrypoint] Running alembic upgrade head from /app..."
cd /app
if alembic upgrade head; then
    echo "[entrypoint] alembic upgrade head: OK"
else
    echo "[entrypoint] WARNING: alembic upgrade failed (exit $?)."
    echo "[entrypoint] Likely cause: Base.metadata.create_all() pre-created tables on a previous boot."
    echo "[entrypoint] Container will start anyway. Run 'docker exec repo-backend-1 alembic stamp head' to resync."
fi

echo "[entrypoint] Handing off to uvicorn from /app/src..."
cd /app/src
exec "$@"
