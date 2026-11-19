#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║   MD FARHAD UDDIN CHAT BOT  +  FAHU API   —   Render start   ║
# ╚══════════════════════════════════════════════════════════════╝
# 1. generates config.json from environment variables
# 2. starts the Fahu API on Render's $PORT (keeps the service "awake")
# 3. waits for GET /health, then starts the bot (node fahu.js)
#
# Render settings:
#   Build Command : npm install && cd fahu-api && npm install
#   Start Command : bash render-start.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

PORT="${PORT:-10000}"
export PORT

echo "▶ generating config from environment…"
node render-setup.js

echo "▶ starting Fahu API on port ${PORT}…"
(cd fahu-api && node server.js) &
API_PID=$!

echo "▶ waiting for API /health…"
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    echo "✅ API is up"
    break
  fi
  sleep 1
  if [ "$i" -eq 60 ]; then
    echo "❌ API did not become healthy in 60s — check fahu-api logs"
    kill "$API_PID" 2>/dev/null || true
    exit 1
  fi
done

echo "▶ starting bot (node fahu.js)…"
exec node fahu.js
