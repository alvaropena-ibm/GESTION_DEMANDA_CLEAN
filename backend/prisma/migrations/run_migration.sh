#!/bin/bash

# Script to run time_entries migration
# This avoids shell history issues with special characters

export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
export PGPASSWORD='GestionDemanda2024!'

psql -h gestion-demanda-db.czuimyk2qu10.eu-west-1.rds.amazonaws.com \
     -U postgres \
     -d gestion_demanda \
     -p 5432 \
     -f 20260127_create_time_entries_table.sql

echo ""
echo "Verificando que la tabla se creó correctamente..."
psql -h gestion-demanda-db.czuimyk2qu10.eu-west-1.rds.amazonaws.com \
     -U postgres \
     -d gestion_demanda \
     -p 5432 \
     -c "\dt time_entries"

unset PGPASSWORD