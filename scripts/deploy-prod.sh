#!/usr/bin/env bash
# Деплой админки Вайбика в прод: /opt/apps/vaybik-hub (compose-проект vaybik-hub-prod).
#
#   scripts/deploy-prod.sh --dry-run      # только показать, что будет выкачено (ничего не меняет)
#   scripts/deploy-prod.sh                # проверки в dev → тег отката → pull → build → up -d → health
#   scripts/deploy-prod.sh --skip-checks  # без lint/typecheck/test (только если их уже прогнали)
#
# Выкатывается то, что лежит в origin/main на GitHub, — сначала git push из dev.
# Не трогает: Traefik, acme.json, VPN, firewall, .env прода (только читает имя проекта).
set -euo pipefail

# Не наследовать DOCKER_HOST/POSTGRES_*/SITE_* из shell или dev-.env —
# иначе `docker compose` ходит не туда / подставляет чужой пароль / сбрасывает cutover (SITE_PROD_PRIORITY).
# Важно: `docker compose` подхватывает DOCKER_HOST ещё и из прод-.env —
# там он нужен контейнерам (socket-proxy), а хостовый CLI должен ходить на локальный сокет.
unset DOCKER_HOST POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB DATABASE_URL \
  SITE_PROD_PRIORITY SITE_PUBLIC_ORIGIN || true
export DOCKER_HOST=
# Обёртка: compose не должен видеть DOCKER_HOST / чужие SITE_* из shell
dc() {
  env -u DOCKER_HOST -u POSTGRES_USER -u POSTGRES_PASSWORD -u POSTGRES_DB -u DATABASE_URL \
    -u SITE_PROD_PRIORITY -u SITE_PUBLIC_ORIGIN \
    docker compose "$@"
}

PROD_DIR="${PROD_DIR:-/opt/apps/vaybik-hub}"
DEV_DIR="${DEV_DIR:-/opt/vaybik-hub}"
IMAGE="vaybik-hub-prod"
HEALTH_URL="${HEALTH_URL:-https://vaybik.ru/admin/api/health}"
KEEP_PREV=3

DRY=0; CHECKS=1
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --skip-checks) CHECKS=0 ;;
    -h|--help) sed -n 2,10p "$0"; exit 0 ;;
    *) echo "Неизвестный аргумент: $a" >&2; exit 2 ;;
  esac
done

say()  { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# ── Защита ──────────────────────────────────────────────────────────────
[ "$(id -un)" = "deploy" ] || fail "Запускать от пользователя deploy (сейчас: $(id -un))."
[ -d "$PROD_DIR/.git" ] || fail "Нет прод-checkout $PROD_DIR."
[ -f "$PROD_DIR/.env" ] || fail "Нет $PROD_DIR/.env — прод не настроен."
grep -q '^COMPOSE_PROJECT_NAME=vaybik-hub-prod' "$PROD_DIR/.env" || fail "В $PROD_DIR/.env нет COMPOSE_PROJECT_NAME=vaybik-hub-prod."
[ -f "$PROD_DIR/docker-compose.override.yml" ] || fail "Нет docker-compose.override.yml (образ $IMAGE)."

cd "$PROD_DIR"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] || fail "Прод не на ветке main (сейчас $BRANCH)."
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short --untracked-files=no
  fail "В проде есть незакоммиченные правки отслеживаемых файлов. Прод правится только через git."
fi

git fetch -q origin main
CUR="$(git rev-parse --short HEAD)"
NEW="$(git rev-parse --short origin/main)"
git merge-base --is-ancestor HEAD origin/main || fail "origin/main не продолжает текущий прод ($CUR) — нужна ручная проверка."

say "Прод сейчас: $CUR → будет: $NEW"
if [ "$CUR" = "$NEW" ]; then
  echo "Новых коммитов нет."
else
  git log --oneline "HEAD..origin/main"
  NEW_MIGR="$(git diff --name-only HEAD origin/main -- prisma/migrations | grep -c 'migration.sql' || true)"
  [ "$NEW_MIGR" -gt 0 ] && echo "⚠ Новых миграций БД: $NEW_MIGR (применятся при старте app; откат образа их НЕ отменяет)."
fi

if [ "$DRY" = 1 ]; then
  say "Пробный запуск: ничего не менял."
  echo "Откат после реального деплоя будет: cd $PROD_DIR && docker tag $IMAGE:prev-$CUR $IMAGE:latest && docker compose up -d --no-build --force-recreate app worker site"
  exit 0
fi

# ── Проверки кода (в dev-checkout, на том же коммите) ──────────────────
if [ "$CHECKS" = 1 ]; then
  say "Проверки lint / typecheck / test в $DEV_DIR"
  DEV_HEAD="$(git -C "$DEV_DIR" rev-parse --short HEAD)"
  [ "$DEV_HEAD" = "$NEW" ] || fail "dev ($DEV_HEAD) ≠ origin/main ($NEW). Сначала git pull/push в $DEV_DIR."
  (cd "$DEV_DIR" && npm run -s lint && npm run -s typecheck && npm test --silent) || fail "Проверки не прошли — деплой отменён."
fi

# ── Тег для отката ─────────────────────────────────────────────────────
say "Сохраняю текущий образ как $IMAGE:prev-$CUR"
if docker image inspect "$IMAGE:latest" >/dev/null 2>&1; then
  docker tag "$IMAGE:latest" "$IMAGE:prev-$CUR"
else
  echo "Образа $IMAGE:latest нет — первый деплой, откатываться некуда."
fi
# Откат = вернуть прежний образ. Код в git остаётся новым: потом исправить и выкатить заново (git revert + деплой).
ROLLBACK="cd $PROD_DIR && docker tag $IMAGE:prev-$CUR $IMAGE:latest && env -u DOCKER_HOST docker compose up -d --no-build --force-recreate app worker site"

# ── Каталог бэкапов на хосте (bind-mount → /app/backups, uid nextjs=1001) ─
BACKUPS_HOST="${BACKUPS_HOST_DIR:-/var/backups/vaybik}"
# Подхватить из прод-.env, если задано (без печати значения других ключей)
if [ -f "$PROD_DIR/.env" ]; then
  # grep=1 если ключа нет — не валим скрипт (set -e / pipefail)
  _bh="$(grep -E '^BACKUPS_HOST_DIR=' "$PROD_DIR/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
  [ -n "${_bh:-}" ] && BACKUPS_HOST="$_bh"
  unset _bh
fi
# Опционально добавить в прод-.env пустой ключ не требуется — дефолт /var/backups/vaybik
say "Каталог бэкапов: $BACKUPS_HOST"
if [ ! -d "$BACKUPS_HOST" ]; then
  sudo mkdir -p "$BACKUPS_HOST"
fi
sudo chown 1001:1001 "$BACKUPS_HOST"
sudo chmod 700 "$BACKUPS_HOST"

# ── Выкатка ────────────────────────────────────────────────────────────
say "git pull → build → up -d"
git merge -q --ff-only origin/main
dc build app
dc up -d app worker site

# ── Проверка здоровья ──────────────────────────────────────────────────
say "Жду healthy (до 3 минут)"
ok=0
for _ in $(seq 1 36); do
  s_app="$(docker inspect -f '{{.State.Health.Status}}' vaybik-hub-prod-app-1 2>/dev/null || echo none)"
  s_wrk="$(docker inspect -f '{{.State.Health.Status}}' vaybik-hub-prod-worker-1 2>/dev/null || echo none)"
  s_site="$(docker inspect -f '{{.State.Health.Status}}' vaybik-hub-prod-site-1 2>/dev/null || echo none)"
  if [ "$s_app" = healthy ] && [ "$s_wrk" = healthy ] && [ "$s_site" = healthy ] && curl -fsS -m 10 "$HEALTH_URL" >/dev/null 2>&1; then ok=1; break; fi
  sleep 5
done
dc ps

if [ "$ok" != 1 ]; then
  dc logs --tail 60 app || true
  dc logs --tail 40 site || true
  printf '\n\033[1;31m✖ Прод не стал здоровым (app=%s worker=%s site=%s).\033[0m\nОткат одной командой:\n  %s\n' "$s_app" "$s_wrk" "$s_site" "$ROLLBACK" >&2
  exit 1
fi

# ── Уборка старых тегов отката (оставляем $KEEP_PREV) ──────────────────
docker images --format '{{.Repository}}:{{.Tag}} {{.CreatedAt}}' | awk -v img="$IMAGE:prev-" 'index($1,img)==1' \
  | sort -k2 -r | awk 'NR>'"$KEEP_PREV"' {print $1}' | xargs -r docker rmi >/dev/null 2>&1 || true

say "Готово: прод на $NEW, $HEALTH_URL отвечает."
echo "Если что-то не так — откат:"
echo "  $ROLLBACK"
