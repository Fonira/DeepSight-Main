-- pg_stat_statements activation for slow-query monitoring.
--
-- Mounted at /docker-entrypoint-initdb.d/ on the postgres container.
-- This script runs ONLY on first init (empty data dir). On existing volumes,
-- run `CREATE EXTENSION pg_stat_statements;` manually inside psql.
--
-- Requires `shared_preload_libraries=pg_stat_statements` in postgresql.conf
-- (set via the postgres `command:` in docker-compose.yml). Restart needed.

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
