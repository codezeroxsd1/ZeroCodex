@echo off
REM Apply migration SQL to Postgres using psql. Update PG connection vars as needed.
SET PGHOST=localhost
SET PGPORT=5432
SET PGUSER=postgres
SET PGPASSWORD=
SET PGDATABASE=zero_db

echo Applying migration: migrations\20260722_add_missing_order_columns.sql
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f migrations\20260722_add_missing_order_columns.sql
pause
