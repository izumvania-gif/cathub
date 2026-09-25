#!/usr/bin/env bash
# Local PocketBase for development: downloads the pinned version into .pocketbase/ and runs it
# with the repo's migrations and hooks. Usage: pnpm dev:pb  (or: bash scripts/pocketbase.sh <args>)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(cat "$ROOT/pocketbase/VERSION")"

# Load .env (superuser credentials) if present.
if [[ -f "$ROOT/.env" ]]; then set -a; . "$ROOT/.env"; set +a; fi
DIR="$ROOT/.pocketbase"
BIN="$DIR/pocketbase-$VERSION"

if [[ ! -x "$BIN" ]]; then
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64) PLATFORM=linux_amd64 ;;
    Linux-aarch64) PLATFORM=linux_arm64 ;;
    Darwin-x86_64) PLATFORM=darwin_amd64 ;;
    Darwin-arm64) PLATFORM=darwin_arm64 ;;
    *) echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
  esac
  mkdir -p "$DIR"
  URL="https://github.com/pocketbase/pocketbase/releases/download/v$VERSION/pocketbase_${VERSION}_${PLATFORM}.zip"
  echo "Downloading PocketBase $VERSION ($PLATFORM)..."
  curl -fsSL "$URL" -o "$DIR/pb.zip"
  unzip -o -q "$DIR/pb.zip" pocketbase -d "$DIR"
  mv "$DIR/pocketbase" "$BIN"
  rm "$DIR/pb.zip"
fi

if [[ "${1:-}" == "serve" ]]; then
  shift
  if [[ -n "${PB_SUPERUSER_EMAIL:-}" && -n "${PB_SUPERUSER_PASSWORD:-}" ]]; then
    "$BIN" superuser upsert "$PB_SUPERUSER_EMAIL" "$PB_SUPERUSER_PASSWORD" --dir="$DIR/pb_data" >/dev/null
  fi
  exec "$BIN" serve --http=127.0.0.1:8090 --dir="$DIR/pb_data" \
    --publicDir="$ROOT/apps/web/dist" --hooksDir="$ROOT/pocketbase/pb_hooks" \
    --migrationsDir="$ROOT/pocketbase/pb_migrations" "$@"
fi

exec "$BIN" "$@" --dir="$DIR/pb_data" --migrationsDir="$ROOT/pocketbase/pb_migrations"
