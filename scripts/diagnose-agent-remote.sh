#!/usr/bin/env bash
# SSH into a remote server (optionally over Cloudflare tunnel) and check the
# SelfHost agent service and logs. Use this to debug why a server isn't coming online.
#
# Usage:
#   Over tunnel (homelab):
#     ./scripts/diagnose-agent-remote.sh -u USER -h TUNNEL_HOSTNAME [-i SSH_KEY] [--tunnel]
#   Direct SSH:
#     ./scripts/diagnose-agent-remote.sh -u USER -h IP_OR_HOSTNAME [-p PORT] [-i SSH_KEY]
#
# Examples:
#   ./scripts/diagnose-agent-remote.sh -u root -h myhomelab.cfargotunnel.com -i ~/.ssh/selfhost_key --tunnel
#   ./scripts/diagnose-agent-remote.sh -u ubuntu -h 192.168.1.50 -p 22

set -e

USER=""
HOST=""
PORT="22"
KEY=""
USE_TUNNEL=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -u|--user)   USER="$2"; shift 2 ;;
    -h|--host)   HOST="$2"; shift 2 ;;
    -p|--port)   PORT="$2"; shift 2 ;;
    -i|--key)    KEY="$2"; shift 2 ;;
    --tunnel)    USE_TUNNEL=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$USER" || -z "$HOST" ]]; then
  echo "Usage: $0 -u USER -h HOST [ -p PORT ] [ -i SSH_KEY ] [ --tunnel ]"
  echo "  --tunnel  use Cloudflare tunnel: ProxyCommand=cloudflared access ssh --hostname %h"
  exit 1
fi

TARGET="${USER}@${HOST}"
SSH_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=45)
[[ -n "$KEY" ]] && SSH_OPTS+=(-i "$KEY")
[[ "$PORT" != "22" ]] && SSH_OPTS+=(-p "$PORT")
if $USE_TUNNEL; then
  SSH_OPTS+=(-o "ProxyCommand=cloudflared access ssh --hostname %h")
fi

REMOTE_SCRIPT='
echo "========== INIT SYSTEM =========="
if [ -d /run/systemd/system ]; then echo "systemd"; systemctl is-active selfhost-agent 2>/dev/null || true; systemctl status selfhost-agent --no-pager 2>/dev/null || true
elif [ -f /sbin/openrc ]; then echo "openrc"; rc-service selfhost-agent status 2>/dev/null || true
else echo "unknown"; fi

echo ""
echo "========== BUN / START SCRIPT =========="
echo "Bun at fixed path:"; ls -la /var/lib/selfhost/.bun/bin/bun 2>/dev/null || echo "(not found)"
echo "Bun in PATH:"; command -v bun 2>/dev/null || echo "(not found)"
echo "start.sh BUN_INSTALL line:"; grep -E "^export BUN_INSTALL=" /var/lib/selfhost/start.sh 2>/dev/null || echo "(no start.sh or no BUN_INSTALL)"
echo "start.sh first 20 lines:"; head -20 /var/lib/selfhost/start.sh 2>/dev/null || echo "(no start.sh)"

echo ""
echo "========== AGENT LOG (last 80 lines) =========="
if [ -f /var/log/selfhost-agent.log ]; then tail -80 /var/log/selfhost-agent.log; else echo "(no log file)"; fi

echo ""
echo "========== SERVICE UNIT (if systemd) =========="
[ -f /etc/systemd/system/selfhost-agent.service ] && cat /etc/systemd/system/selfhost-agent.service || true
echo ""
echo "========== OPENRC SCRIPT (if openrc) =========="
[ -f /etc/init.d/selfhost-agent ] && head -30 /etc/init.d/selfhost-agent || true
'

echo "Connecting to $TARGET ${USE_TUNNEL:+ (over tunnel)} ..."
echo ""
ssh "${SSH_OPTS[@]}" "$TARGET" "$REMOTE_SCRIPT"
