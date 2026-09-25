#!/bin/sh
# Runs PocketBase and the bot in one container (docs/DEPLOY_AMVERA.md §3).
# If either process exits, the container exits too and the platform restarts it.
set -u

PB_DIR=/data/pb_data
mkdir -p "$PB_DIR"

if [ -n "${PB_SUPERUSER_EMAIL:-}" ] && [ -n "${PB_SUPERUSER_PASSWORD:-}" ]; then
  /pb/pocketbase superuser upsert "$PB_SUPERUSER_EMAIL" "$PB_SUPERUSER_PASSWORD" \
    --dir="$PB_DIR" --migrationsDir=/pb/pb_migrations >/dev/null \
    || echo "entrypoint: superuser upsert failed" >&2
else
  echo "entrypoint: PB_SUPERUSER_EMAIL/PB_SUPERUSER_PASSWORD not set; open /_/ to create a superuser" >&2
fi

# PocketBase defaults to 127.0.0.1; the platform needs 0.0.0.0 (otherwise 503).
/pb/pocketbase serve --http=0.0.0.0:8090 --dir="$PB_DIR" \
  --publicDir=/pb/pb_public --hooksDir=/pb/pb_hooks --migrationsDir=/pb/pb_migrations &
PB_PID=$!

node --no-deprecation /app/bot/index.js &
BOT_PID=$!

shutdown() {
  kill -TERM "$BOT_PID" "$PB_PID" 2>/dev/null
  wait
  exit 0
}
trap shutdown TERM INT

wait -n
echo "entrypoint: a process exited, stopping container" >&2
kill -TERM "$BOT_PID" "$PB_PID" 2>/dev/null
wait
exit 1
