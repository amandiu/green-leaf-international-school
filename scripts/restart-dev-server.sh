#!/usr/bin/env bash
# Restart the Green Leaf API on :5000 with FRESH rate-limit buckets.
# Used between live test-suite runs — the in-memory express-rate-limit
# buckets (login 10/10min, forgot 5/15min, uploads 30/15min) are
# per-process, so back-to-back suites otherwise throttle each other.
cd "$(dirname "$0")/.."
PID=$(netstat -ano 2>/dev/null | grep ':5000' | grep LISTENING | awk '{print $5}' | head -1)
if [ -n "$PID" ]; then
  taskkill //PID "$PID" //F >/dev/null 2>&1
  sleep 2
fi
cd server
node src/server.js > /tmp/greenleaf-dev.log 2>&1 &
cd ..
for i in $(seq 1 20); do
  sleep 1
  if curl -s -m 2 http://127.0.0.1:5000/api/health >/dev/null 2>&1; then
    echo "server up (fresh rate-limit buckets)"
    exit 0
  fi
done
echo "server failed to start" >&2
exit 1
