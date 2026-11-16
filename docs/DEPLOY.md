# Деплой vaybik-hub (продакшн)

Инструкция для **человека**. Агенты Cursor на сервер не заходят и не деплоят.

Сервер: FirstVDS, Ubuntu 24.04. Traefik уже работает и выдаёт сертификаты Let's Encrypt.

## ⛔ Не трогать

- VPN: Amnezia, Xray, WireGuard — контейнеры, конфиги, `/etc/amnezia/*`, `/opt/xray/config.json`
- `acme.json` (сертификаты Traefik)
- Конфиг самого Traefik и правила firewall
- `/etc/ssh/sshd_config`
- Сырой `/var/run/docker.sock` в контейнер **app/worker** не монтировать — только через `docker-proxy`

Админка только добавляет **labels** своему контейнеру и подключается к **существующей** внешней сети Traefik.

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
cd /opt/vaybik-hub
git pull
docker compose build
docker compose up -d
docker compose logs -f app --tail=80
```

Миграции применятся при рестарте app. VPN / Traefik / acme.json не затрагиваются.

## 8. Бэкапы

Worker ежедневно в **03:00 Europe/Moscow** пишет в volume `backups`:

- `db-<stamp>.sql.gz.enc` — `pg_dump` + gzip + AES-256-GCM (`BACKUP_ENCRYPTION_KEY`)
- `uploads-<stamp>.tar.gz.enc` — архив uploads

Хранение **14 дней** (старые `.enc` удаляются).

### Ручной бэкап

```bash
docker compose exec worker npx tsx scripts/backup-now.ts
```

### Список файлов

```bash
docker compose exec worker ls -la /app/backups
```

### Скачать бэкап на хост

```bash
docker compose cp worker:/app/backups ./backups-host
```

### Восстановление БД (осторожно — перезапишет данные)

1. Остановить app и worker: `docker compose stop app worker`
2. Убедиться, что `BACKUP_ENCRYPTION_KEY` в `.env` совпадает с ключом бэкапа
3. Восстановить:

```bash
# скопировать .enc в контейнер postgres-доступный путь или выполнить из app:
docker compose start postgres
docker compose run --rm -e RUN_MIGRATIONS=0 app \
  npx tsx scripts/restore-backup.ts /app/backups/db-XXXX.sql.gz.enc
```

Либо расшифровать на хосте с тем же скриптом, указав `DATABASE_URL` на порт postgres (если пробросите локально только для restore — **не** публикуйте 5432 в постоянном compose).

4. Запустить снова: `docker compose up -d`

Восстановление uploads: расшифровать `uploads-*.tar.gz.enc` (скрипт `decryptAndGunzip` / отдельный шаг) и распаковать tar в volume `uploads`.

## 9. Откат образа

```bash
docker images | grep vaybik-hub
# при наличии тега/дайджеста предыдущей сборки — docker tag … && docker compose up -d
```

Храните один предыдущий успешно собранный образ до проверки новой версии.

## 10. Ресурсы

Ожидаемо: app + worker + postgres + docker-proxy ≤ **1 GB RAM** суммарно. Не поднимайте лишние сервисы на этом же хосте без нужды.

---

Вопросы по имени сети Traefik / certresolver — в `docs/progress.md` «Факты сервера». Если факты меняются, обновите `.env`, **не** правьте конфиг Traefik из админки.
