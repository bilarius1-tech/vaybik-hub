#!/usr/bin/env bash
# Переключение публичного vaybik.ru на CMS site-сервер (и обратно).
#   scripts/site-cutover.sh status
#   scripts/site-cutover.sh on [--force]
#   scripts/site-cutover.sh off
# Экстренный откат: cd /opt/apps/vaybik-hub && env -u DOCKER_HOST docker compose stop site
set -euo pipefail

PROD_DIR="${PROD_DIR:-/opt/apps/vaybik-hub}"
unset DOCKER_HOST || true
dc() { env -u DOCKER_HOST docker compose "$@"; }

cmd="status"
force=0
for arg in "$@"; do
  case "$arg" in
    on|off|status) cmd="$arg" ;;
    --force) force=1 ;;
    *) echo "Usage: $0 status|on [--force]|off"; exit 2 ;;
  esac
done

set_env_key() {
  local key="$1" val="$2" file="$PROD_DIR/.env"
  if grep -qE "^${key}=" "$file"; then
    sed -i -E "s|^${key}=.*|${key}=${val}|" "$file"
  else
    printf '\n%s=%s\n' "$key" "$val" >>"$file"
  fi
}

case "$cmd" in
  status)
    echo "SITE_PROD_PRIORITY=$(grep -E '^SITE_PROD_PRIORITY=' "$PROD_DIR/.env" 2>/dev/null | cut -d= -f2- || echo unset)"
    echo "SITE_PUBLIC_ORIGIN=$(grep -E '^SITE_PUBLIC_ORIGIN=' "$PROD_DIR/.env" 2>/dev/null | cut -d= -f2- || echo unset)"
    curl -sI https://vaybik.ru/ 2>/dev/null | grep -iE '^(HTTP|x-vaybik-site)' || true
    ;;
  on)
    if [ "$force" != 1 ]; then
      report="$(ls -1t /tmp/site-parity-*.md 2>/dev/null | head -1 || true)"
      [ -n "$report" ] || { echo "Нет parity-отчёта в /tmp/site-parity-*.md (или --force)"; exit 1; }
      age=$(( $(date +%s) - $(stat -c %Y "$report") ))
      [ "$age" -le 86400 ] || { echo "Parity-отчёт старше 24 ч: $report (или --force)"; exit 1; }
      if grep -E '\| FAIL \|' "$report" >/dev/null 2>&1; then
        echo "Parity содержит FAIL — cutover запрещён (или --force)"; exit 1
      fi
    else
      echo "Cutover ON с --force (parity не проверяем)"
    fi
    set_env_key SITE_PROD_PRIORITY 50
    set_env_key SITE_PUBLIC_ORIGIN https://vaybik.ru
    cd "$PROD_DIR"
    dc up -d site
    ok=0
    for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
      sleep 2
      if curl -sI https://vaybik.ru/ 2>/dev/null | grep -qi 'x-vaybik-site: cms'; then
        ok=1
        break
      fi
    done
    [ "$ok" = 1 ] || { echo "Нет X-Vaybik-Site: cms"; exit 1; }
    curl -fsS -m 10 https://vaybik.ru/admin/api/health >/dev/null
    curl -fsS -m 10 -o /dev/null -w '%{http_code}\n' https://vaybik.ru/css/site.css | grep -q 200
    echo "Cutover ON. Откат: scripts/site-cutover.sh off"
    echo "Экстренно: cd $PROD_DIR && env -u DOCKER_HOST docker compose stop site"
    ;;
  off)
    set_env_key SITE_PROD_PRIORITY 1
    cd "$PROD_DIR"
    dc up -d site
    sleep 2
    curl -sI https://vaybik.ru/ | grep -i 'x-vaybik-site' && echo "⚠ всё ещё cms?" || echo "OK: nginx (нет X-Vaybik-Site)"
    echo "Cutover OFF"
    ;;
esac
