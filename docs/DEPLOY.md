# Деплой vaybik-hub (продакшн)

Первичная установка (разделы 1–6) уже сделана. **Обновление прода** — только `scripts/deploy-prod.sh` (запускает агент от `deploy`, см. `docs/WORKFLOW.md` §7): тег отката `vaybik-hub-prod:prev-<sha>`, pull, build, up -d, health-check, печать команды отката. Прод: `/opt/apps/vaybik-hub`, `COMPOSE_PROJECT_NAME=vaybik-hub-prod`, образ задаёт `docker-compose.override.yml`.

Сервер: FirstVDS, Ubuntu 24.04. Traefik уже работает и выдаёт сертификаты Let's Encrypt.

## ⛔ Не трогать

- VPN: Amnezia, Xray, WireGuard — контейнеры, конфиги, `/etc/amnezia/*`, `/opt/xray/config.json`
- `acme.json` (сертификаты Traefik)
- Конфиг самого Traefik и правила firewall
- `/etc/ssh/sshd_config`
- Сырой `/var/run/docker.sock` в контейнер **app/worker** не монтировать — только через `docker-proxy`

Админка только добавляет **labels** своему контейнеру и подключается к **существующей** внешней сети Traefik.

### Label `vaybik.managed=true` (фаза 2)

Чтобы админка могла restart/start/stop/логи/обновление контейнера сервиса:

1. В `docker-compose.yml` сервиса добавьте label (генератор в админке уже вставляет его):

```yaml
labels:
  - vaybik.managed=true
```

2. В карточке сервиса в админке (`/admin/services/...`) укажите **точное имя контейнера** (как в `docker ps`), например `region` или `vaybik-hub-prod-app-1`.
3. Контейнеры Traefik / Amnezia / Xray / WireGuard **никогда** не управляются (denylist), даже если ошибочно попали в реестр.
4. Управление идёт только через `docker-proxy` (POST=1, ALLOW_RESTARTS/START/STOP=1, IMAGES=1). Сырой `docker.sock` в app не монтировать.

После смены env у `docker-proxy` в compose хаба — `docker compose up -d docker-proxy` (или полный деплой скриптом).

---

## 1. Клонирование

```bash
sudo mkdir -p /opt/vaybik-hub
sudo chown "$USER:$USER" /opt/vaybik-hub
git clone https://github.com/bilarius1-tech/vaybik-hub.git /opt/vaybik-hub
cd /opt/vaybik-hub
```

## 2. Сеть Traefik

Убедитесь, что внешняя сеть есть (имя из фактов сервера — `proxy`):

```bash
docker network ls | grep -E 'proxy|traefik'
```

Если сети нет — **не** пересоздавайте Traefik. Уточните имя у того, кто ставил Traefik, и пропишите в `.env` как `TRAEFIK_NETWORK=...`.

## 3. Файл `.env`

```bash
cp .env.example .env
nano .env   # или vim
```

### Генерация ключей (на сервере)

```bash
# Пароль Postgres
openssl rand -base64 24

# SESSION_SECRET, VAULT_MASTER_KEY, BACKUP_ENCRYPTION_KEY — каждый по 32 байта base64:
openssl rand -base64 32
openssl rand -base64 32
openssl rand -base64 32
```

Заполните минимум:

| Переменная | Значение |
|---|---|
| `NODE_ENV` | `production` |
| `APP_ENV` | `prod` |
| `APP_URL` | `https://vaybik.ru/admin` |
| `POSTGRES_USER` | `vaybik` |
| `POSTGRES_PASSWORD` | из `openssl rand -base64 24` |
| `POSTGRES_DB` | `vaybik_admin` |
| `DATABASE_URL` | см. ниже (для контейнеров compose переопределяет на `postgres:5432`) |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `VAULT_MASTER_KEY` | `openssl rand -base64 32` |
| `VAULT_KEY_VERSION` | `1` |
| `BACKUP_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `TRAEFIK_NETWORK` | `proxy` |
| `TRAEFIK_ENTRYPOINT` | `websecure` |
| `TRAEFIK_ENTRYPOINT_HTTP` | `web` |
| `TRAEFIK_CERTRESOLVER` | `le` |
| `TRAEFIK_HTTPS_REDIRECT_MIDDLEWARE` | `to-https@docker` |
| `TRAEFIK_ADMIN_HOST` | `vaybik.ru` |
| `TRAEFIK_ADMIN_PRIORITY` | `100` (выше заглушки) |
| `NEXT_PUBLIC_THEME_VARIANT` | `A` |
| `TELEGRAM_BOT_TOKEN` | опц.; лучше потом положить в Vault (`telegram_bot`) |
| `TELEGRAM_DEFAULT_CHAT_ID` | опц. |

`DATABASE_URL` в `.env` для справки/скриптов с хоста:

```text
DATABASE_URL=postgresql://vaybik:ПАРОЛЬ@127.0.0.1:5432/vaybik_admin?schema=public
```

Внутри compose app/worker получают URL на хост `postgres` автоматически.

Сохраните ключи **вне репозитория** (менеджер паролей). Потеря `VAULT_MASTER_KEY` = потеря секретов vault; потеря `BACKUP_ENCRYPTION_KEY` = нельзя расшифровать бэкапы.

## 4. Сборка и запуск

```bash
cd /opt/vaybik-hub
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f app --tail=100
```

Миграции Prisma выполняются при старте `app` (`RUN_MIGRATIONS=1`).

## 5. Создать owner

```bash
docker compose exec -it app npx tsx scripts/seed-owner.ts
```

Введите email и пароль (≥ 12 символов). При первом входе на `https://vaybik.ru/admin` обязательна настройка 2FA — без неё дальше setup-2fa не пустит (если `REQUIRE_2FA=false` — 2FA по желанию, включается в профиле).

Без вопросов (например, из скрипта): `docker compose exec -e SEED_EMAIL=… -e SEED_PASSWORD=… app npx tsx scripts/seed-owner.ts`.

Вход: `REQUIRE_2FA` (true/false) и `SESSION_REMEMBER_DAYS` (по умолчанию 30) в `.env`; после изменения — `docker compose up -d`.

## 6. Проверка

```bash
# Health внутри сети / с хоста через Traefik
curl -fsS https://vaybik.ru/admin/api/health

# Публичный sitemap
curl -fsS https://vaybik.ru/admin/api/public/sitemap.xml | head

# Логи worker (health-checks, бэкап в 03:00 Europe/Moscow)
docker compose logs -f worker --tail=50
```

В браузере: `https://vaybik.ru/admin/login` → 2FA → дашборд.

## 7. Обновление

```bash
cd /opt/vaybik-hub                 # dev-checkout, код уже в origin/main
scripts/deploy-prod.sh --dry-run   # что поедет
scripts/deploy-prod.sh             # выкатка + health + команда отката
```

Миграции применятся при рестарте app. VPN / Traefik / acme.json не затрагиваются.

## 8. Бэкапы

### Где лежат файлы

На VPS канонический каталог хоста: **`/var/backups/vaybik`** (`chmod 700`, владелец uid **1001** / пользователь `nextjs` в образе).  
В compose app и worker монтируют его как bind-mount → `/app/backups` (переменная `BACKUPS_HOST_DIR`, по умолчанию `/var/backups/vaybik`). Named volume `backups` больше не используется.

Каталог создаётся автоматически скриптом `scripts/deploy-prod.sh` при «задеплой» (`mkdir` + `chown 1001:1001` + `chmod 700`). Не кладите бэкапы в git и не в `/opt/apps`.

Структура файлов:

- `/var/backups/vaybik/admin/db-<stamp>.dump.enc` — `pg_dump -Fc` + AES-256-GCM (`BACKUP_ENCRYPTION_KEY`)
- `/var/backups/vaybik/admin/uploads-<stamp>.tar.gz.enc` — архив uploads
- `/var/backups/vaybik/<slug>/<stamp>.dump.enc` (+ `.sha256`) — дампы зарегистрированных подключений

Старый формат `db-*.sql.gz.enc` (plain + gzip) ещё понимает `scripts/restore-backup.ts`, новые дампы — только `-Fc`.

Worker ежедневно в **03:00 Europe/Moscow** бэкапит админку (+ uploads). Дополнительные Postgres — по `DbConnection.backupSchedule` (cron, Europe/Moscow). Ретенция: 14 дней у админки; у подключений — поле `retention`. Перед дампом проверяется свободное место (≥ 2× размер БД + запас).

Клиент `pg_dump`/`pg_restore` в образе — **PostgreSQL 16** (как сервер). URI с `?schema=public` в argv не передаётся (только `PG*` env).

### Ручной бэкап

```bash
docker compose exec worker npx tsx scripts/backup-now.ts
# или из UI: /admin/databases → карточка → «Сделать бэкап»
```

### Список файлов

```bash
# на хосте:
sudo ls -la /var/backups/vaybik/admin
# или в контейнере:
docker compose exec worker ls -la /app/backups/admin
```

### Скачать бэкап

Через админку (ADMIN+, после reauth) — только файл `.enc`.  
Либо с хоста: скопировать из `/var/backups/vaybik/...` (нужны права).

### Проверка целостности дампа

```bash
docker compose exec worker npx tsx -e "
  const { verifyCustomDumpEnc } = require('./src/server/backup/connection-dump.ts');
" 
# проще: кнопка/API POST /admin/api/backups/:id/verify
# или вручную: расшифровать → pg_restore -l dump
```

### Тестовый restore (не в прод!)

В UI кнопка «Тест restore» (только OWNER + reauth + точное имя БД) поднимает одноразовый контейнер `postgres:16-alpine` в сети `hub`, заливает дамп, проверяет таблицы и удаляет контейнер. **Восстановить в прод-БД админки из UI нельзя.**

Скрипт на хосте (dev или после явного «да» на проде):

```bash
BACKUP_ENCRYPTION_KEY=... npx tsx scripts/backup-restore-test.ts /var/backups/vaybik/admin/db-XXXX.dump.enc
```

### Восстановление в рабочую БД (осторожно — перезапишет данные)

Только вручную, по отдельному заданию владельца. Не делайте `docker compose down -v`.

1. Свежий бэкап источника.
2. Остановить app и worker: `docker compose stop app worker`
3. Убедиться, что `BACKUP_ENCRYPTION_KEY` совпадает с ключом файла
4. Восстановить:

```bash
docker compose start postgres
docker compose run --rm -e RUN_MIGRATIONS=0 worker \
  npx tsx scripts/restore-backup.ts /app/backups/admin/db-XXXX.dump.enc
```

5. Запустить снова: `docker compose up -d`

Восстановление uploads: расшифровать `uploads-*.tar.gz.enc` и распаковать tar в volume `uploads`.

## 9. Откат образа

```bash
cd /opt/apps/vaybik-hub
docker images | grep vaybik-hub-prod          # теги prev-<sha> (хранятся 3 последних)
docker tag vaybik-hub-prod:prev-<sha> vaybik-hub-prod:latest
docker compose up -d --no-build --force-recreate app worker
```
Точную команду печатает `scripts/deploy-prod.sh`. Миграции БД откат образа не отменяет.

Храните один предыдущий успешно собранный образ до проверки новой версии.

## 10. Ресурсы

Ожидаемо: app + worker + postgres + docker-proxy ≤ **1 GB RAM** суммарно. Не поднимайте лишние сервисы на этом же хосте без нужды.

---

Вопросы по имени сети Traefik / certresolver — в `docs/progress.md` «Факты сервера». Если факты меняются, обновите `.env`, **не** правьте конфиг Traefik из админки.
