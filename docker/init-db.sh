#!/bin/sh
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE crm_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'crm_test')\gexec

    -- Exclusively for the "full" Docker Compose profile (docker compose
    -- --profile full up), deliberately separate from crm_dev/crm_test so
    -- that profile can never read, write, or reseed a developer's real
    -- local data — see docs/decisions.md.
    SELECT 'CREATE DATABASE crm_docker'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'crm_docker')\gexec
EOSQL
