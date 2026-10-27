#!/bin/bash
set -e

# Tạo extension btree_gist trên development database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS btree_gist;
EOSQL

# Tạo test database nếu chưa tồn tại và cấp quyền
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE carsharing_test OWNER ' || quote_ident('$POSTGRES_USER')
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'carsharing_test')\gexec
EOSQL

# Cài đặt btree_gist trên test database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "carsharing_test" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS btree_gist;
EOSQL

echo "Initialized PostgreSQL dev and test databases with btree_gist successfully."
