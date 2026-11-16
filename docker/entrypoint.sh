#!/bin/sh
set -e

# Миграции только для app (worker стартует после depends_on, но app делает migrate сам).
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "[entrypoint] prisma migrate deploy…"
  npx prisma migrate deploy
fi

exec "$@"
