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

echo "[entrypoint] Running alembic upgrade heads from /app..."
cd /app
# Use `heads` (plural) to handle divergent migration branches gracefully —
# `head` (singular) plante silencieusement quand 2+ heads sont présentes (cas
# typique après merge de 2 branches feature qui ont chacune ajouté une migration
# basée sur le même parent). Incident concret : sprint Visual Analysis Phase 2
# 2026-05-06 — `019_visual_analysis_quota` + `022_summary_extras` divergeaient
# à `018_hub_workspace`, `alembic upgrade head` échouait, container démarrait
# sans migrations 023+024 appliquées.
if alembic upgrade heads; then
    echo "[entrypoint] alembic upgrade heads: OK"
else
    echo "[entrypoint] WARNING: alembic upgrade failed (exit $?)."
    echo "[entrypoint] Likely cause: Base.metadata.create_all() pre-created tables on a previous boot,"
    echo "[entrypoint] OR alembic_version.version_num column trop courte (32 chars default — voir incident 023)."
    echo "[entrypoint] Container will start anyway. Run 'docker exec repo-backend-1 alembic stamp heads' to resync."
fi

echo "[entrypoint] Handing off to uvicorn from /app/src..."
cd /app/src
exec "$@"
