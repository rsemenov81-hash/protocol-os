#!/usr/bin/env bash
# Self-contained protocol test for both MCP servers. Stands in a mock `agy`
# (so it runs anywhere, no real Gemini/Ultra needed) and asserts the JSON-RPC
# behaviour + model routing. Real end-to-end with live Gemini must be run on a
# machine where `agy` is installed and logged in.
#
#   bash .claude/mcp/test-servers.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASS=0; FAIL=0

chk() { # desc, haystack, needle
  if printf '%s' "$2" | grep -qF -- "$3"; then
    echo "  PASS: $1"; PASS=$((PASS+1))
  else
    echo "  FAIL: $1"; echo "    expected substring: $3"; echo "    actual: $2"; FAIL=$((FAIL+1))
  fi
}

# --- mock agy on PATH: echoes routing + prompt so we can assert ---
TMP="$(mktemp -d)"
cat > "$TMP/agy" <<'EOF'
#!/usr/bin/env bash
model=""; thinking="no"; prompt=""
while [ $# -gt 0 ]; do
  case "$1" in
    --version) echo "agy mock 0.0.1"; exit 0;;
    --help) echo "usage: agy -m MODEL [--thinking high] -p PROMPT"; exit 0;;
    -m) model="$2"; shift 2;;
    --thinking) thinking="$2"; shift 2;;
    -p) prompt="$2"; shift 2;;
    *) shift;;
  esac
done
echo "[MOCK model=$model thinking=$thinking] reply: $prompt"
EOF
chmod +x "$TMP/agy"
export PATH="$TMP:$PATH"

echo "== Local stdio server (gemini-mcp) =="
OUT="$(printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"ask_gemini","arguments":{"prompt":"verify dose math","mode":"deep"}}}' \
  '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"ask_gemini","arguments":{"prompt":"2+2","mode":"quick"}}}' \
  | node "$ROOT/gemini-mcp/index.js")"
chk "initialize returns serverInfo"      "$OUT" '"name":"gemini"'
chk "tools/list exposes ask_gemini"      "$OUT" '"ask_gemini"'
chk "deep -> Gemini 3.1 Pro"             "$OUT" 'model=gemini-3.1-pro'
chk "deep -> thinking high"              "$OUT" 'thinking=high'
chk "deep -> prompt passed through"      "$OUT" 'verify dose math'
chk "quick -> Gemini 3.5 Flash"          "$OUT" 'model=gemini-3.5-flash'
chk "quick -> no thinking flag"          "$OUT" 'thinking=no'

echo "== Remote HTTP server (gemini-remote) =="
PORT=8791
MCP_AUTH_TOKEN=secret123 GEMINI_API_KEY="" PORT=$PORT node "$ROOT/gemini-remote/server.js" 2>/dev/null &
SRV=$!
sleep 1
U="$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/" \
      -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')"
chk "rejects missing bearer (401)"       "$U" "401"
A="$(curl -s -X POST "http://127.0.0.1:$PORT/" -H 'content-type: application/json' \
      -H 'authorization: Bearer secret123' -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')"
chk "authorized tools/list works"        "$A" '"ask_gemini"'
E="$(curl -s -X POST "http://127.0.0.1:$PORT/" -H 'content-type: application/json' \
      -H 'authorization: Bearer secret123' \
      -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"ask_gemini","arguments":{"prompt":"hi"}}}')"
chk "missing API key -> graceful error"  "$E" "GEMINI_API_KEY is not set"
kill "$SRV" 2>/dev/null

rm -rf "$TMP"
echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
