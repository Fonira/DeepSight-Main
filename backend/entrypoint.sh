#!/bin/sh
# Backend container entrypoint.
# Optionally runs alembic migrations before launching uvicorn.
#
# Set RUN_MIGRATIONS=true to apply pending migrations on container start.
# Defaults to false so local dev / staging containers don't surprise-migrate
# a shared database. Production sets RUN_MIGRATIONS=true via the deploy workflow.

set -e

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[entrypoint] RUN_MIGRATIONS=true — running alembic upgrade head"
  cd /app && alembic upgrade head
  echo "[entrypoint] alembic upgrade head done"
fi

cd /app/src
exec "$@"
