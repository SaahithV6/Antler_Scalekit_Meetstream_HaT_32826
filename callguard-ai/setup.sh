#!/usr/bin/env bash
# CallGuard AI — end-to-end setup script for Arch Linux
# Run from inside the callguard-ai/ directory:  bash setup.sh
set -e

# ──────────────────────────────────────────────
#  Cleanup on unexpected exit
# ──────────────────────────────────────────────
NGROK_MCP_PID=""
NGROK_WEBHOOK_PID=""
WEBHOOK_PID=""

cleanup() {
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    echo ""
    err "Setup failed (exit code $exit_code). Cleaning up background processes…"
    [[ -n "$NGROK_MCP_PID" ]]     && kill "$NGROK_MCP_PID"     2>/dev/null || true
    [[ -n "$NGROK_WEBHOOK_PID" ]] && kill "$NGROK_WEBHOOK_PID" 2>/dev/null || true
    [[ -n "$WEBHOOK_PID" ]]       && kill "$WEBHOOK_PID"        2>/dev/null || true
  fi
}
trap cleanup EXIT

# ──────────────────────────────────────────────
#  Colors
# ──────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'   # No Colour

ok()   { echo -e "${GREEN}✓${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*" >&2; }
info() { echo -e "${YELLOW}▸${NC} $*"; }

# ──────────────────────────────────────────────
#  1. Check prerequisites
# ──────────────────────────────────────────────
info "Checking prerequisites…"

check_cmd() {
  local cmd="$1"
  local hint="$2"
  if ! command -v "$cmd" &>/dev/null; then
    err "'$cmd' is not installed."
    echo "    Install hint: $hint"
    exit 1
  fi
}

check_cmd docker  "sudo pacman -S docker && sudo systemctl enable --now docker"
check_cmd ngrok   "yay -S ngrok  OR  download from https://ngrok.com/download"
check_cmd python3 "sudo pacman -S python"
check_cmd pip     "sudo pacman -S python-pip"

# Python version ≥ 3.11
PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
if [[ "$PY_MAJOR" -lt 3 || ( "$PY_MAJOR" -eq 3 && "$PY_MINOR" -lt 11 ) ]]; then
  err "Python $PY_VER found — Python 3.11+ is required."
  echo "    Install hint: sudo pacman -S python"
  exit 1
fi

ok "All prerequisites satisfied (Python $PY_VER)"

# ──────────────────────────────────────────────
#  2. Copy .env if it doesn't exist
# ──────────────────────────────────────────────
info "Checking .env…"

if [ ! -f .env ]; then
  cp .env.example .env
  ok ".env created from .env.example"
fi

# Helper: read current value of a key from .env
env_get() {
  grep -E "^$1=" .env | head -1 | cut -d= -f2-
}

# Helper: update (or add) a key=value line in .env
env_set() {
  local key="$1"
  local val="$2"
  if grep -qE "^${key}=" .env; then
    # Escape characters that would break sed's delimiter
    local escaped_val
    escaped_val=$(printf '%s\n' "$val" | sed 's/[&/\]/\\&/g')
    sed -i "s|^${key}=.*|${key}=${escaped_val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

PLACEHOLDER_PATTERN='your_|YOUR_|example\.|your-env'

prompt_if_placeholder() {
  local key="$1"
  local prompt_text="$2"
  local current
  current=$(env_get "$key")
  if [[ -z "$current" || "$current" =~ $PLACEHOLDER_PATTERN ]]; then
    echo -e "${YELLOW}  ${prompt_text}${NC}"
    read -rp "  Enter $key: " new_val
    env_set "$key" "$new_val"
  fi
}

info "Checking required .env values…"
prompt_if_placeholder SCALEKIT_ENV_URL      "Scalekit environment URL  (e.g. https://yourenv.scalekit.dev)"
prompt_if_placeholder SCALEKIT_CLIENT_ID    "Scalekit Client ID"
prompt_if_placeholder SCALEKIT_CLIENT_SECRET "Scalekit Client Secret"
prompt_if_placeholder MEET_STREAM_API_KEY   "MeetStream API Key"
prompt_if_placeholder ESCALATION_EMAIL      "Escalation email address"
prompt_if_placeholder JIRA_PROJECT_KEY      "Jira project key  (e.g. CG)"

ok ".env is ready"

# ──────────────────────────────────────────────
#  3. Install Python deps for auth_check.py
# ──────────────────────────────────────────────
info "Installing Python dependencies for auth_check.py…"
pip install --user scalekit-sdk-python python-dotenv --quiet
ok "Python dependencies installed"

# ──────────────────────────────────────────────
#  4. Run auth_check.py
# ──────────────────────────────────────────────
info "Running auth_check.py — follow the prompts to authorize Jira & Gmail…"
python3 auth_check.py
ok "Auth check complete"

# ──────────────────────────────────────────────
#  5. Build the Docker image
# ──────────────────────────────────────────────
info "Building Docker image callguard-mcp…"
cd mcp_server
docker build -t callguard-mcp .
cd ..
ok "Docker image built"

# ──────────────────────────────────────────────
#  6. Start the Docker container
# ──────────────────────────────────────────────
info "Starting Docker container…"

if docker ps -a --format '{{.Names}}' | grep -q '^callguard-mcp$'; then
  info "Removing existing callguard-mcp container…"
  docker stop callguard-mcp  >/dev/null 2>&1 || true
  docker rm   callguard-mcp  >/dev/null 2>&1 || true
fi

docker run -d --env-file .env -p 8000:8000 --name callguard-mcp callguard-mcp
ok "Docker container started"

# ──────────────────────────────────────────────
#  7. Wait for the MCP server to be ready
# ──────────────────────────────────────────────
info "Waiting for MCP server on http://localhost:8000/ …"
WAIT=0
until curl -sf http://localhost:8000/ >/dev/null 2>&1; do
  sleep 2
  WAIT=$((WAIT + 2))
  if [[ $WAIT -ge 30 ]]; then
    err "MCP server did not start within 30 seconds."
    echo "    Check logs: docker logs callguard-mcp"
    exit 1
  fi
done
ok "MCP server is up"

# ──────────────────────────────────────────────
#  8. Start ngrok for the MCP server
# ──────────────────────────────────────────────
info "Starting ngrok tunnel for MCP server (port 8000)…"
ngrok http 8000 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_MCP_PID=$!

WAIT=0
NGROK_URL=""
until [[ -n "$NGROK_URL" ]]; do
  sleep 2
  WAIT=$((WAIT + 2))
  NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'])" 2>/dev/null || true)
  if [[ $WAIT -ge 15 ]]; then
    err "ngrok tunnel for MCP did not start within 15 seconds."
    echo "    Check logs: tail -f /tmp/ngrok.log"
    exit 1
  fi
done

ok "MCP Server public URL: ${NGROK_URL}"

# ──────────────────────────────────────────────
#  9. Start the webhook server
# ──────────────────────────────────────────────
info "Installing webhook dependencies and starting webhook server…"
cd webhook
pip install --user flask requests scalekit-sdk-python python-dotenv --quiet
python3 main.py > /tmp/webhook.log 2>&1 &
WEBHOOK_PID=$!
cd ..

info "Waiting for webhook server on http://localhost:8999/ …"
sleep 3
WAIT=0
until curl -sf http://localhost:8999/ >/dev/null 2>&1; do
  sleep 2
  WAIT=$((WAIT + 2))
  if [[ $WAIT -ge 20 ]]; then
    err "Webhook server did not start within 20 seconds."
    echo "    Check logs: tail -f /tmp/webhook.log"
    exit 1
  fi
done
ok "Webhook server is up (PID $WEBHOOK_PID)"

# ──────────────────────────────────────────────
#  10. Start ngrok for the webhook server
# ──────────────────────────────────────────────
info "Starting ngrok tunnel for webhook (port 8999)…"
ngrok http 8999 --log=stdout > /tmp/ngrok_webhook.log 2>&1 &
NGROK_WEBHOOK_PID=$!

WAIT=0
WEBHOOK_URL=""
until [[ -n "$WEBHOOK_URL" ]]; do
  sleep 2
  WAIT=$((WAIT + 2))
  # The webhook tunnel is the second one; pick the public_url that maps to 8999
  WEBHOOK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
    | python3 -c "
import sys, json
tunnels = json.load(sys.stdin)['tunnels']
for t in tunnels:
    if '8999' in t.get('config', {}).get('addr', ''):
        print(t['public_url'])
        sys.exit(0)
# fallback: second tunnel
if len(tunnels) > 1:
    print(tunnels[1]['public_url'])
" 2>/dev/null || true)
  if [[ $WAIT -ge 15 ]]; then
    err "ngrok tunnel for webhook did not start within 15 seconds."
    echo "    Check logs: tail -f /tmp/ngrok_webhook.log"
    exit 1
  fi
done

ok "Webhook public URL: ${WEBHOOK_URL}"

# ──────────────────────────────────────────────
#  11. Final summary
# ──────────────────────────────────────────────
MEETSTREAM_API_KEY=$(env_get MEET_STREAM_API_KEY)

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  CallGuard AI — Setup Complete${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  MCP Server URL (paste into MeetStream MIA):"
echo -e "  ${GREEN}→ ${NGROK_URL}/mcp${NC}"
echo ""
echo -e "  Webhook URL (paste as callback_url in create_bot):"
echo -e "  ${GREEN}→ ${WEBHOOK_URL}/webhook${NC}"
echo ""
echo -e "  MIA Agent Header:"
echo -e "  ${GREEN}→ Name:  ngrok-skip-browser-warning${NC}"
echo -e "  ${GREEN}→ Value: 1${NC}"
echo ""
echo -e "  To send a bot to a meeting:"
cat <<EOF
  curl -X POST https://api.meetstream.ai/api/v1/bots/create_bot \\
    -H "Authorization: Token ${MEETSTREAM_API_KEY}" \\
    -H "Content-Type: application/json" \\
    -d '{
      "meeting_link": "https://meet.google.com/xxx-xxxx-xxx",
      "bot_name": "CallGuard AI",
      "agent_config_id": "YOUR_AGENT_CONFIG_ID",
      "recording_config": {
        "transcript": {
          "provider": { "deepgram": { "model": "nova-2", "smart_format": true } }
        }
      }
    }'
EOF
echo ""
echo -e "  Logs:"
echo -e "  ${GREEN}→ MCP server:  docker logs callguard-mcp${NC}"
echo -e "  ${GREEN}→ Webhook:     tail -f /tmp/webhook.log${NC}"
echo -e "  ${GREEN}→ ngrok MCP:   tail -f /tmp/ngrok.log${NC}"
echo -e "  ${GREEN}→ ngrok hook:  tail -f /tmp/ngrok_webhook.log${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
