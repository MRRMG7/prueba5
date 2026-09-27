#!/usr/bin/env bash
# Levanta el backend en local contra la base de datos de Docker (puerto 3307).
# Uso:  ./run-local.sh
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -x venv/bin/python3 ]; then
  echo "No existe venv/. Crea el entorno virtual primero (ver README)." >&2
  exit 1
fi

# Puerto 3307 = MySQLLevantado en Docker (prueba-db-1). Cambialo si usas 3306.
export DATABASE_URL="${DATABASE_URL:-mysql+pymysql://app_user:password123@127.0.0.1:3307/logistica_db}"

# Al arrancar, create_all + las migraciones crean/ajustan las tablas que falten.
cd backend
exec ../venv/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
