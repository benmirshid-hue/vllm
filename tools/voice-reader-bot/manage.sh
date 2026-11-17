#!/usr/bin/env bash
# Scoped service manager for tools/voice-reader-bot only.
# Does not touch user personal apps outside this directory.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT/.voice-bot.pid"
LOG_FILE="$ROOT/.voice-bot.log"
PORT="${VOICE_BOT_PORT:-8765}"
PY="${PYTHON:-python3}"

usage() {
  echo "Usage: $0 {start|stop|restart|status|test-tts}"
  echo "Scope: $ROOT only"
}

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

start_svc() {
  if is_running; then
    echo "already running pid=$(cat "$PID_FILE") port=$PORT"
    return 0
  fi
  cd "$ROOT"
  nohup "$PY" -m uvicorn server:app --host 0.0.0.0 --port "$PORT" >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  for _ in 1 2 3 4 5 6 7 8; do
    sleep 0.5
    if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
      echo "started pid=$(cat "$PID_FILE") port=$PORT scope=$ROOT"
      return 0
    fi
  done
  echo "failed to start; see $LOG_FILE" >&2
  exit 1
}

stop_svc() {
  if ! is_running; then
    rm -f "$PID_FILE"
    echo "not running"
    return 0
  fi
  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid" 2>/dev/null || true
  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
  echo "stopped pid=$pid scope=$ROOT"
}

status_svc() {
  if is_running; then
    echo "running pid=$(cat "$PID_FILE") port=$PORT"
    curl -fsS "http://127.0.0.1:$PORT/api/services" || true
    echo
  else
    echo "stopped scope=$ROOT"
  fi
}

test_tts() {
  curl -fsS -o /tmp/voice-bot-noura.mp3 \
    "http://127.0.0.1:$PORT/api/tts?voice=Noura&delivery=warm&text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7"
  ls -la /tmp/voice-bot-noura.mp3
  curl -fsS "http://127.0.0.1:$PORT/api/voices" | "$PY" -c 'import sys,json;d=json.load(sys.stdin);print("voices",d["count"])'
}

cmd="${1:-}"
case "$cmd" in
  start) start_svc ;;
  stop) stop_svc ;;
  restart) stop_svc; start_svc ;;
  status) status_svc ;;
  test-tts) test_tts ;;
  *) usage; exit 1 ;;
esac
