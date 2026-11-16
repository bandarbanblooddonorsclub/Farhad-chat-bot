#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║   MD FARHAD UDDIN CHAT BOT  +  FAHU API      one-shot start   ║
# ╚══════════════════════════════════════════════════════════════╝
# 1. starts the Fahu API  (fahu-api/server.js, default port 4040)
# 2. waits until GET /health answers
# 3. starts the bot       (node fahu.js)
#
#   chmod +x start-fahu.sh && ./start-fahu.sh
#
# Options:
#   API_PORT=4040 ./start-fahu.sh
#   NO_API=1 ./start-fahu.sh          # skip the API, run the bot only

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

API_PORT="${API_PORT:-4040}"
API_HOST="${API_HOST:-127.0.0.1}"
HEALTH="http://${API_HOST}:${API_PORT}/health"
API_PID=""

cyan='\033[0;36m'; green='\033[0;32m'; yellow='\033[1;33m'; red='\033[0;31m'; nc='\033[0m'
say()  { printf "%b\n" "$1"; }
line() { say "${cyan}────────────────────────────────────────────────────────${nc}"; }

cleanup() {
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    say "\n${yellow}▸ stopping Fahu API (pid $API_PID)${nc}"
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# ── 1. dependencies ────────────────────────────────────────────────
line
say "${cyan}▸ Checking dependencies${nc}"

if [ ! -d node_modules ]; then
  say "  ${yellow}installing bot dependencies…${nc}"
  npm install
fi

if [ "${NO_API:-0}" != "1" ]; then
  if [ ! -d fahu-api/node_modules ]; then
    say "  ${yellow}installing Fahu API dependencies…${nc}"
    ( cd fahu-api && npm install )
  fi
fi

# ── 2. sync FAHU_API into config.json ──────────────────────────────
if [ "${NO_API:-0}" != "1" ] && command -v node >/dev/null 2>&1; then
  node - <<EOF
try {
  const fs = require('fs');
  const p = 'config.json';
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const want = 'http://${API_HOST}:${API_PORT}';
  if (d.FAHU_API !== want) {
    d.FAHU_API = want;
    fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n");
    console.log('  config.json → FAHU_API set to ' + want);
  } else {
    console.log('  config.json → FAHU_API already ' + want);
  }
} catch (e) { /* non-fatal */ }
EOF
fi

# ── 3. start the Fahu API ──────────────────────────────────────────
if [ "${NO_API:-0}" != "1" ]; then
  line
  say "${cyan}▸ Starting Fahu API on port ${API_PORT}${nc}"
  ( cd fahu-api && PORT="$API_PORT" HOST="$API_HOST" exec node server.js ) &
  API_PID=$!

  say "  waiting for ${HEALTH}"
  for i in $(seq 1 40); do
    if curl -fsS --max-time 2 "$HEALTH" >/dev/null 2>&1; then
      say "  ${green}✔ Fahu API is up${nc}"
      break
    fi
    if ! kill -0 "$API_PID" 2>/dev/null; then
      say "  ${red}✘ Fahu API exited during startup${nc}"
      break
    fi
    sleep 0.5
  done
fi

# ── 4. start the bot ───────────────────────────────────────────────
line
say "${cyan}▸ Starting MD FARHAD UDDIN chat bot${nc}"
say "  registry: ${HEALTH%/health}/API.json"
line
node fahu.js
