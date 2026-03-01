# PostgreSQL Setup (Local Dev)

This project (`hdb`) uses PostgreSQL for local development.

## Platform

These commands target Pop!_OS 22.04 / Ubuntu 22.04.

## Install PostgreSQL

```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
```

## Start and Enable Service

```bash
sudo systemctl enable --now postgresql
sudo systemctl status postgresql --no-pager
```

## Verify Installation

```bash
psql --version
pg_isready
```

Expected:
- `psql` prints a PostgreSQL version
- `pg_isready` returns `accepting connections`

## Create a Local Role and Database for hdb

Replace `hdb_password` with a local dev password.

```bash
sudo -u postgres psql -c "CREATE ROLE hdb_user WITH LOGIN PASSWORD 'hdb_password';"
sudo -u postgres psql -c "CREATE DATABASE hdb OWNER hdb_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE hdb TO hdb_user;"
```

## Connect Test

```bash
psql "postgresql://hdb_user:hdb_password@localhost:5432/hdb" -c "select now();"
```

## Environment Variable Example

Use a standard Postgres connection string:

```bash
export DATABASE_URL="postgresql://hdb_user:hdb_password@localhost:5432/hdb"
```

## Troubleshooting

- If `pg_isready` fails:
  - `sudo systemctl restart postgresql`
  - `sudo journalctl -u postgresql -n 100 --no-pager`
- If auth fails:
  - verify role exists: `sudo -u postgres psql -c "\du"`
  - verify database exists: `sudo -u postgres psql -c "\l"`

## Optional: Docker Instead of System Install

Use this when you do not want a machine-level Postgres install:

```bash
docker run --name hdb-postgres \
  -e POSTGRES_USER=hdb_user \
  -e POSTGRES_PASSWORD=hdb_password \
  -e POSTGRES_DB=hdb \
  -p 5432:5432 \
  -d postgres:16
```

Verify:

```bash
docker logs hdb-postgres --tail 50
psql "postgresql://hdb_user:hdb_password@localhost:5432/hdb" -c "select version();"
```
