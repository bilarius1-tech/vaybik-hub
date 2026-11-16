# ТЗ: админка хаба Вайбик (vaybik.ru/admin)

Версия 0.1 · 16.11.2026 · заказчик: Алексей Тимофеев (Lead-web / Вайбик)

## 1. Цель

vaybik.ru — хаб сервисов студии: каждый сервис живёт на своём поддомене (`chat.vaybik.ru`, `lead.vaybik.ru`, `region.vaybik.ru` и далее). Нужна **одна умная админка** по адресу `https://vaybik.ru/admin`, в которой можно:

- видеть состояние всех сервисов и сервера на одном дашборде;
- подключать новые сервисы, следить за ними и управлять ими (перезапуск, обновление, логи);
- настраивать сам Вайбик (бренд, контент публичного сайта) и его SEO;
- безопасно хранить логины, пароли и API-ключи;
- подключать партнёров и интеграции;
- смотреть базы данных и бэкапы;
- управлять пользователями, ролями, 2FA; видеть журнал действий; получать уведомления в Telegram.

Публичный сайт остаётся на `https://vaybik.ru/`, админка — на `/admin` за логином. Стиль — как km-dashboard (см. `docs/DESIGN.md`).

## 2. Окружение (факты)

- Сервер: FirstVDS VPS, IP 199.189.250.208, Ubuntu 24.04, 4 CPU / 8 GB RAM / 80 GB диск.
- Входящий трафик принимает **Traefik** (reverse proxy, сертификаты Let's Encrypt).
- Сейчас `vaybik.ru` — статическая заглушка «скоро открытие» (nginx за Traefik). `region.vaybik.ru` тоже там.
- На сервере работает VPN (Amnezia, Xray). **Его не трогать.** Запрещено изменять: `acme.json`, `/etc/amnezia/*`, `/opt/xray/config.json`, `sshd_config`, контейнеры/сервисы VPN, правила firewall, настройки самого Traefik, кроме добавления labels своим контейнерам.
- Агенты Cursor **не заходят на сервер** и не деплоят. Деплой делает Алексей вручную по `docs/DEPLOY.md` (пишется в фазе 1).

## 3. Стек (рекомендация)

| Слой | Выбор | Почему |
|---|---|---|
| Приложение | **Next.js (актуальная стабильная, App Router) + TypeScript**, `basePath: '/admin'`, `output: 'standalone'` | одно приложение = UI + API (Route Handlers / Server Actions), SSR, легко собрать в один Docker-образ; Игорь (фронт) и Алексей (бэк) работают в одном репо |
| БД | **PostgreSQL 16** | надёжно, JSONB для гибких настроек, стандарт для бэкапов (`pg_dump`) |
| ORM | **Prisma** | типобезопасная схема, миграции, Prisma Studio для разработки |
| Стили | **Tailwind CSS** + CSS-переменные из km-dashboard | быстро, токены в одном месте, тёмная/светлая тема |
| Графики | Chart.js 4 (react-chartjs-2) | как в km-dashboard |
| Валидация | Zod | общие схемы для форм и API |
| Аутентификация | собственная: argon2id-пароли, сессии в БД (httpOnly cookie), TOTP (`otplib`) | полный контроль, без внешних зависимостей; Auth.js не обязателен |
| Шифрование секретов | Node `crypto` AES-256-GCM, мастер-ключ из env | без внешних сервисов |
| Фоновые задачи | отдельный процесс `worker` (тот же образ, другая команда) + `pg-boss` (очередь на PostgreSQL) | health-checks по расписанию, бэкапы, уведомления — без Redis |
| Docker | **tecnativa/docker-socket-proxy** (только нужные эндпоинты), клиент `dockerode` | сырой `/var/run/docker.sock` = root на хосте; прокси ограничивает API |
| Развёртывание | Docker Compose, сеть Traefik, labels | Traefik уже стоит и выдаёт сертификаты |
| Тесты | Vitest (unit), Playwright (e2e основных сценариев) | |
| Качество | ESLint, Prettier, `tsc --noEmit`, GitHub Actions CI | |

Роутинг: Traefik-роутер `Host(\`vaybik.ru\`) && PathPrefix(\`/admin\`)` с приоритетом выше, чем у роутера nginx-заглушки. Публичный сайт не меняется (в будущем публичную часть может отдавать это же приложение — см. фазу 5).

## 4. Роли

| Роль | Права |
|---|---|
| `owner` | всё, включая пользователей, мастер-операции (ротация ключа, восстановление БД), удаление |
| `admin` | сервисы, настройки, SEO, доступы (с ограничением по «папкам»), БД (без restore), партнёры |
| `partner` | только свой кабинет: свои интеграции, API-ключи, вебхуки, реферальная статистика, свои сервисы (если выданы) |

Права проверяются **на сервере** в каждом обработчике (helper `requireRole()` / `can(user, action, resource)`), UI только скрывает недоступное.

## 5. Модули

### 5.1. Дашборд (`/admin`)
- KPI-строка (`k5`): сервисов онлайн N/M, заявок сегодня/за 7 дней, визитов (Метрика), CPU/RAM/диск сервера, дней до ближайшего истечения сертификата/домена/оплаты сервера.
- Таблица сервисов: статус (StatusDot), аптайм 24ч/7д, время ответа, спарклайн, версия, последний деплой.
- Графики: визиты/заявки по дням; время ответа сервисов; нагрузка сервера (CPU/RAM/диск) за 24ч.
- «Внимание» (`Alert`): упавшие сервисы, сертификат < 14 дней, неудачный бэкап, диск > 80%, неуспешные входы.
- Переключатель периода (День / Неделя / Месяц), live-точка «обновлено …».
- Источники метрик сервера: worker читает `/proc` хоста (read-only mount `/proc` → `/host/proc`: CPU, RAM, load) и `statfs` смонтированного read-only корня для диска; по контейнерам — Docker stats (фаза 2). Отдельный Prometheus в MVP не нужен. Визиты — Яндекс.Метрика API (фаза 3), заявки — из сервисов через вебхук/API.

### 5.2. Сервисы (`/admin/services`)
Реестр всех поддоменов-сервисов.
- Поля: название, slug, поддомен/URL, описание, иконка, тип (`docker` / `external` / `static`), имя контейнера(ов) или compose-проект, репозиторий GitHub, ветка, URL health-check, ожидаемый код/текст, интервал, таймаут, теги, владелец (пользователь/партнёр), видимость на публичной витрине.
- Health-checks (worker): HTTP(S) GET, статус-код, время ответа, срок SSL-сертификата, ключевое слово; хранить результаты (агрегировать старше 7 дней по часам). Смена статуса → событие + Telegram.
- Docker (фаза 2): статус контейнера, uptime, CPU/RAM (stats), **restart**, **start/stop** (только owner/admin, с подтверждением), **обновление**: `docker pull` образа + recreate (через «deploy-хук»: см. 8.3), логи (tail + поток SSE, фильтр, скачать).
- Генератор **Traefik labels** для нового сервиса: на вход поддомен, порт, имя сети, certresolver → готовый блок `docker-compose.yml` для копирования (админка сама Traefik не настраивает).
- Публичная витрина: флаг «показывать на vaybik.ru», порядок, описание.

### 5.3. Настройки Вайбика (`/admin/settings`)
- Бренд: название, слоган, логотип/маскот, фавиконы, цвета (выбор варианта темы A/B/C из DESIGN.md), контакты, соцсети.
- Контент публичного сайта: блоки главной (hero, сервисы, о студии, контакты), статус «скоро открытие / открыто», баннер.
- Хранение: таблица `Setting` (key → JSONB) + загрузка файлов (каталог `uploads` в volume, проверка MIME/размера).
- Публичный API `GET /admin/api/public/site` (кешируемый) — чтобы публичный сайт мог брать контент.

### 5.4. SEO (`/admin/seo`)
- Страницы: путь, title, description, canonical, robots (index/noindex), OG-title/description/image, Twitter card, JSON-LD (Organization/WebSite).
- Превью сниппета Яндекса/Google и OG-карточки (карточка в стиле калькулятора: ввод слева/сверху — результат крупно), счётчики длины (title ≤ 60, description ≤ 160).
- Генерация `sitemap.xml` и `robots.txt` (в т.ч. для поддоменов, по флагу), публичные эндпоинты.
- Идентификаторы: Яндекс.Вебмастер (meta verification), Яндекс.Метрика (ID счётчика), Google Search Console (verification), Google Analytics (опц.).
- Проверка: кнопка «проверить страницу» — загрузить URL и показать найденные meta/ошибки.

### 5.5. Доступы (`/admin/vault`)
Зашифрованное хранилище логинов, паролей, API-ключей, SSH-заметок.
- Запись: название, тип (`login`, `api_key`, `note`, `db`, `ssh`), URL, логин, секрет(ы), заметка, теги, «папка» (проект/сервис/партнёр), кто имеет доступ.
- Шифрование: **AES-256-GCM**, для каждой записи свой случайный DEK (32 байта), шифрует поля; DEK шифруется мастер-ключом `VAULT_MASTER_KEY` (32 байта base64 из env, не в БД, не в репо). Хранить `ciphertext`, `iv` (12 байт), `authTag`, `keyVersion`. Ротация мастер-ключа — команда `npm run vault:rotate` (перешифровывает DEK).
- Показ/копирование секрета — только после **повторной аутентификации** (пароль + TOTP, действует 5 минут), в UI маска, копирование в буфер с автоочисткой через 30 с.
- Каждое чтение/изменение секрета → `AuditLog` (кто, когда, IP, что).
- Генератор паролей. Импорт CSV (owner). Экспорт — только owner, зашифрованный архив.
- Секреты никогда не логируются, не возвращаются в списках, не кладутся в URL.

### 5.6. Партнёры (`/admin/partners`)
- Партнёр: компания, контакт, статус, реферальный код, % вознаграждения, привязанные пользователи (роль `partner`), сервисы.
- Интеграции: API-ключи партнёра (показываются один раз, в БД — хеш SHA-256 + префикс), scopes, срок действия, отзыв.
- Вебхуки: URL, события (`lead.created`, `service.down` …), секрет подписи (HMAC-SHA256 в заголовке `X-Vaybik-Signature`), ретраи с backoff, журнал доставок.
- Рефералы: переходы `?ref=CODE` (cookie 30 дней), заявки и оплаты по коду, начисления, статистика (карточки KPI + таблица).
- Кабинет партнёра (`/admin/partner`) — урезанный дашборд только с его данными.

### 5.7. Базы данных (`/admin/databases`)
- Список подключений (сама БД админки + БД сервисов): тип (PostgreSQL, MySQL), хост, имя, размер, число таблиц, версия; учётные данные — ссылка на запись в «Доступах».
- Размеры БД и крупнейших таблиц, график роста.
- **Read-only браузер**: список таблиц, схема, просмотр строк с пагинацией и фильтром. Подключение отдельным **read-only пользователем БД**; запросы с `statement_timeout` и лимитом строк; произвольный SQL — только `SELECT` у owner, через read-only транзакцию.
- Бэкапы: по расписанию (worker, `pg_dump`/`mysqldump` в сжатый файл, шифрование, хранение N последних + выгрузка во внешнее хранилище S3-совместимое — опционально), ручной запуск, скачать, статус, Telegram при ошибке.
- Restore — только owner, ввод имени БД для подтверждения, предварительный бэкап перед восстановлением.

### 5.8. Пользователи и роли (`/admin/users`)
- Приглашение по ссылке (одноразовый токен, 48ч), роли, блокировка, сброс 2FA (owner), активные сессии с возможностью завершить.
- Первый пользователь-owner создаётся командой `npm run seed:owner` (email + пароль из интерактивного ввода, не из env).

### 5.9. 2FA
- TOTP (RFC 6238, 30 с, 6 цифр), QR при настройке, 10 одноразовых резервных кодов (хранить хеши).
- **Обязательна** для owner и admin (без 2FA — только экран настройки 2FA). Переключатель `REQUIRE_2FA=false` (стадия стартапа) делает 2FA необязательной: вход по паролю для тех, у кого 2FA не включена; включившие 2FA всё равно вводят код; reauth без 2FA — только паролем.

### 5.10. Журнал действий (`/admin/activity`)
- `AuditLog`: actor, action, entity, entityId, diff (без секретов), IP, user-agent, время. Фильтры, экспорт CSV. Записи не редактируются и не удаляются из UI.

### 5.11. Уведомления Telegram (`/admin/settings/notifications`)
- Бот (токен в «Доступах»), чаты-получатели, правила: какие события (сервис упал/поднялся, сертификат истекает, бэкап упал, вход с нового IP, новый партнёр, новая заявка), тихие часы, анти-спам (не чаще 1 раза в N минут на событие).
- Кнопка «Отправить тест».

### 5.12. Бэкапы самой админки
- Ежедневный `pg_dump` БД админки + архив `uploads`, хранение 14 дней, шифрование ключом `BACKUP_ENCRYPTION_KEY`. Инструкция восстановления в `docs/DEPLOY.md`.

## 6. Карта страниц

```
/admin/login                      вход (email+пароль) → /admin/login/2fa
/admin/setup-2fa                  настройка TOTP
/admin                            Дашборд
/admin/services                   реестр  · /new · /[slug] (обзор, проверки, логи, docker, labels)
/admin/settings                   бренд · контент сайта · уведомления · тема
/admin/seo                        страницы · /[id] · sitemap/robots · счётчики
/admin/vault                      записи · /[id]
/admin/partners                   список · /[id] (ключи, вебхуки, рефералы)
/admin/partner                    кабинет партнёра
/admin/databases                  список · /[id] (таблицы, браузер, бэкапы)
/admin/users                      пользователи, приглашения, сессии
/admin/activity                   журнал
/admin/profile                    профиль, пароль, 2FA, сессии
```

Меню сайдбара (иконки — юникод, как в km-dashboard): ◈ Дашборд · ⌂ Сервисы · ✦ Настройки Вайбика · ◎ SEO · ⚿ Доступы · ⇄ Партнёры · ▤ Базы данных · ☺ Пользователи · ≡ Журнал. Внизу sidefoot: «Сервисов онлайн», «CPU / RAM», «Бэкап: сегодня 03:00 ✓».

## 7. Модель данных (Prisma, черновик — агент уточняет при реализации)

```prisma
enum Role { OWNER ADMIN PARTNER }
enum ServiceType { DOCKER EXTERNAL STATIC }
enum CheckStatus { UP DOWN DEGRADED UNKNOWN }

model User {
  id String @id @default(cuid())
  email String @unique
  name String?
  passwordHash String
  role Role @default(ADMIN)
  totpSecretEnc String?          // зашифровано так же, как секреты vault
  totpEnabled Boolean @default(false)
  backupCodes BackupCode[]
  partnerId String?
  partner Partner? @relation(fields: [partnerId], references: [id])
  isBlocked Boolean @default(false)
  sessions Session[]
  createdAt DateTime @default(now())
  lastLoginAt DateTime?
}
model Session {
  id          String    @id
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash   String    @unique
  ip          String?
  userAgent   String?
  reauthUntil DateTime?
  expiresAt   DateTime
  createdAt   DateTime  @default(now())
}
model BackupCode {
  id       String    @id @default(cuid())
  userId   String
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  codeHash String
  usedAt   DateTime?
}
model Invite {
  id        String    @id @default(cuid())
  email     String
  role      Role
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
}

model Service {
  id String @id @default(cuid())
  slug String @unique
  name String
  url String
  description String?
  type ServiceType @default(DOCKER)
  containerNames String[]
  composeProject String?
  repoUrl String?
  branch String? @default("main")
  healthUrl String?
  expectedStatus Int @default(200)
  keyword String?
  intervalSec Int @default(60)
  timeoutMs Int @default(10000)
  isPublic Boolean @default(false)
  sortOrder Int @default(0)
  tags String[]
  status CheckStatus @default(UNKNOWN)
  lastCheckedAt DateTime?
  certExpiresAt DateTime?
  ownerPartnerId String?
  checks HealthCheck[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
model HealthCheck {
  id         BigInt      @id @default(autoincrement())
  serviceId  String
  service    Service     @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  status     CheckStatus
  httpStatus Int?
  responseMs Int?
  error      String?
  checkedAt  DateTime    @default(now())
  @@index([serviceId, checkedAt])
}
model ServerMetric {
  id        BigInt   @id @default(autoincrement())
  cpu       Float
  memUsed   BigInt
  memTotal  BigInt
  diskUsed  BigInt
  diskTotal BigInt
  load1     Float
  takenAt   DateTime @default(now())
  @@index([takenAt])
}

model Setting {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt
  updatedBy String?
}
model SeoPage {
  id            String   @id @default(cuid())
  host          String   @default("vaybik.ru")
  path          String
  title         String?
  description   String?
  canonical     String?
  robots        String   @default("index,follow")
  ogTitle       String?
  ogDescription String?
  ogImage       String?
  jsonLd        Json?
  inSitemap     Boolean  @default(true)
  priority      Float    @default(0.5)
  changefreq    String   @default("weekly")
  updatedAt     DateTime @updatedAt
  @@unique([host, path])
}

model Secret {
  id String @id @default(cuid())
  title String
  kind String                     // login | api_key | note | db | ssh
  url String?
  username String?
  folder String?
  tags String[]
  dataEnc Bytes                   // AES-256-GCM(JSON полей-секретов, DEK)
  dataIv Bytes
  dataTag Bytes
  dekEnc Bytes                    // AES-256-GCM(DEK, MASTER_KEY)
  dekIv Bytes
  dekTag Bytes
  keyVersion Int @default(1)
  createdById String
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())
}

model Partner {
  id            String     @id @default(cuid())
  name          String
  contact       String?
  email         String?
  status        String     @default("active")
  refCode       String     @unique
  rewardPercent Float      @default(10)
  users         User[]
  apiKeys       ApiKey[]
  webhooks      Webhook[]
  referrals     Referral[]
  createdAt     DateTime   @default(now())
}
model ApiKey {
  id         String    @id @default(cuid())
  partnerId  String?                 // null = ключ сервиса хаба
  partner    Partner?  @relation(fields: [partnerId], references: [id])
  name       String
  prefix     String                  // первые 8 символов для отображения
  keyHash    String    @unique       // SHA-256
  scopes     String[]
  expiresAt  DateTime?
  revokedAt  DateTime?
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())
}
model Webhook {
  id         String            @id @default(cuid())
  partnerId  String?
  partner    Partner?          @relation(fields: [partnerId], references: [id])
  url        String
  events     String[]
  secretEnc  Bytes             // зашифровано как vault
  isActive   Boolean           @default(true)
  deliveries WebhookDelivery[]
}
model WebhookDelivery {
  id        BigInt   @id @default(autoincrement())
  webhookId String
  webhook   Webhook  @relation(fields: [webhookId], references: [id], onDelete: Cascade)
  event     String
  payload   Json
  status    Int?
  attempt   Int      @default(1)
  error     String?
  createdAt DateTime @default(now())
}
model Referral {
  id        BigInt   @id @default(autoincrement())
  partnerId String
  partner   Partner  @relation(fields: [partnerId], references: [id])
  kind      String                   // visit | lead | payment
  amount    Decimal? @db.Decimal(12, 2)
  meta      Json?
  createdAt DateTime @default(now())
}

model DbConnection {
  id             String   @id @default(cuid())
  name           String
  engine         String              // postgres | mysql
  host           String
  port           Int
  database       String
  secretId       String              // read-only учётка в vault
  backupSchedule String?             // cron
  retention      Int      @default(14)
  backups        Backup[]
}
model Backup {
  id             String        @id @default(cuid())
  dbConnectionId String?
  dbConnection   DbConnection? @relation(fields: [dbConnectionId], references: [id])
  target         String                // admin-db | uploads | external
  file           String
  sizeBytes      BigInt?
  status         String
  error          String?
  startedAt      DateTime      @default(now())
  finishedAt     DateTime?
}

model AuditLog {
  id        BigInt   @id @default(autoincrement())
  actorId   String?
  action    String
  entity    String
  entityId  String?
  diff      Json?                      // без секретов
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())
  @@index([createdAt])
  @@index([entity, entityId])
}
model NotificationRule {
  id          String   @id @default(cuid())
  event       String
  chatIds     String[]
  isActive    Boolean  @default(true)
  throttleMin Int      @default(10)
}
model Lead {
  id        String   @id @default(cuid())
  source    String                     // slug сервиса-источника
  name      String?
  contact   String?
  message   String?
  refCode   String?
  status    String   @default("new")
  createdAt DateTime @default(now())
}
```

## 8. API (Route Handlers под `/admin/api`)

Все ответы JSON, ошибки `{ error: { code, message } }`, валидация Zod, CSRF-защита для мутаций (SameSite=Strict cookie + проверка Origin), rate limit на auth.

| Метод | Путь | Роль | Описание |
|---|---|---|---|
| POST | `/auth/login` | — | email+пароль → промежуточный токен 2FA |
| POST | `/auth/2fa` | — | TOTP / резервный код → сессия |
| POST | `/auth/reauth` | любой | повторная проверка (пароль+TOTP) → `reauthUntil` +5 мин |
| POST | `/auth/logout` | любой | |
| GET | `/dashboard/summary?period=` | admin | KPI, алерты |
| GET | `/metrics/server?from&to` | admin | |
| GET/POST | `/services` | admin | список / создать |
| GET/PATCH/DELETE | `/services/:id` | admin (DELETE owner) | |
| GET | `/services/:id/checks?from&to` | admin | история |
| POST | `/services/:id/check` | admin | проверить сейчас |
| POST | `/services/:id/docker/{restart,start,stop}` | admin | фаза 2 |
| POST | `/services/:id/deploy` | admin | фаза 2, вызывает deploy-хук |
| GET | `/services/:id/logs?tail&since` / `/logs/stream` (SSE) | admin | фаза 2 |
| GET | `/services/:id/traefik-labels` | admin | сгенерированный YAML |
| GET/PUT | `/settings/:key` | admin | |
| POST | `/uploads` | admin | файлы бренда |
| GET/POST/PATCH/DELETE | `/seo/pages` | admin | |
| POST | `/seo/inspect` | admin | проверить URL |
| GET | `/public/site`, `/public/sitemap.xml`, `/public/robots.txt`, `/public/services` | публично | кеш 5 мин |
| GET/POST | `/vault` | admin | список без секретов / создать |
| GET | `/vault/:id` | admin | метаданные |
| POST | `/vault/:id/reveal` | admin + reauth | расшифрованные поля, аудит |
| PATCH/DELETE | `/vault/:id` | admin (DELETE owner) | |
| CRUD | `/partners`, `/partners/:id/api-keys`, `/partners/:id/webhooks` | admin | |
| POST | `/webhooks/:id/test` | admin | |
| GET | `/partner/me/*` | partner | кабинет |
| POST | `/ingest/lead` | API-ключ сервиса/партнёра | приём заявок из сервисов |
| GET | `/databases`, `/databases/:id/tables`, `/databases/:id/tables/:t?page&filter` | admin | read-only |
| POST | `/databases/:id/query` | owner | только SELECT |
| POST | `/databases/:id/backup` / `/backups/:id/restore` | admin / owner+reauth | |
| CRUD | `/users`, `/invites`, `/sessions` | owner | |
| GET | `/activity?filters` | admin | |
| CRUD | `/notifications/rules`, POST `/notifications/test` | admin | |
| GET | `/health` | публично | для Traefik/мониторинга |

### 8.3. Обновление сервисов (deploy)
Админка **не получает** права на `docker compose` хоста. Варианты (выбрать в фазе 2, по умолчанию A):
- **A.** Обновление = pull нового образа (из GHCR) + пересоздание контейнера с теми же параметрами через socket-proxy (`POST=1`, `CONTAINERS=1`, `IMAGES=1`). Образы собирает GitHub Actions сервиса.
- **B.** Webhook на лёгкий deploy-агент на хосте (ставит Алексей вручную), который выполняет `docker compose pull && up -d` только для whitelisted каталогов.

## 9. Безопасность (обязательные требования)

1. Пароли — argon2id; политика ≥ 12 символов; блокировка после 5 неудачных попыток на 15 мин (по email и IP); rate limit на `/auth/*`.
2. Сессии: случайный токен 32 байта, в БД — хеш, cookie `__Host-`-префикс невозможен из-за `basePath` → `Secure; HttpOnly; SameSite=Strict; Path=/admin`; срок 12 ч, скользящий; галочка «Запомнить меня» (по умолчанию включена) — постоянная cookie с `Max-Age` и скользящий срок `SESSION_REMEMBER_DAYS` (30 дней); завершение всех сессий при смене пароля.
3. 2FA обязательна для owner/admin. Повторная аутентификация для: показа секретов, restore БД, управления пользователями, ротации ключей, остановки контейнеров.
4. Секреты: AES-256-GCM, envelope encryption (DEK на запись + мастер-ключ из env), никогда в логах/ответах списков/URL; мастер-ключ только в `.env` на сервере, в репо — только `.env.example` с пустыми значениями.
5. RBAC на сервере в каждом обработчике; партнёр видит только свои данные (фильтр по `partnerId` в каждом запросе).
6. CSRF: SameSite=Strict + проверка `Origin`/`Host` для POST/PATCH/DELETE. Все входные данные — Zod.
7. Заголовки: CSP (без `unsafe-eval`), HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`.
8. Docker: только через `tecnativa/docker-socket-proxy` во внутренней сети (не в сети Traefik, без публикации портов). MVP: `CONTAINERS=1, INFO=1, POST=0`. Фаза 2: `POST=1, ALLOW_RESTARTS=1, ALLOW_START=1, ALLOW_STOP=1, IMAGES=1`; `EXEC=0, VOLUMES=0, NETWORKS=0, SWARM=0, SECRETS=0, BUILD=0, PLUGINS=0, SYSTEM=0`. Управлять можно только контейнерами из реестра (whitelist по имени / label `vaybik.managed=true`), контейнеры VPN и Traefik — **никогда** (жёсткий denylist по имени/образу: `traefik`, `amnezia*`, `xray*`, `wg*`).
9. БД-браузер: отдельный read-only пользователь, `statement_timeout=5s`, лимит 500 строк, только SELECT, read-only транзакция.
10. SSRF: health-check и SEO-inspect разрешены только на `http(s)`, запрет приватных IP (кроме явно разрешённых внутренних сервисов из реестра), таймауты.
11. Аудит всех мутаций и всех чтений секретов. Бэкапы шифруются.
12. Зависимости: `npm audit` в CI, Dependabot. Никаких секретов в репо (pre-commit / CI `gitleaks`).
13. Админка не трогает файлы сервера: никаких bind-mount, кроме своих volume и read-only `/proc` (для метрик).

## 10. Нефункциональные требования
- Интерфейс полностью на русском, таймзона Europe/Moscow, формат чисел ru-RU.
- Адаптивность: десктоп — основной, мобильный — дашборд, статусы, перезапуск, уведомления.
- Производительность: дашборд < 1 с на сервере; health-check worker держит 100 сервисов с интервалом 60 с.
- Ресурсы: вся админка (app + worker + postgres + proxy) ≤ 1 GB RAM.
- Тёмная тема по умолчанию + светлая.

## 11. Фазы и критерии приёмки

### Фаза 0. Каркас (1 день)
Next.js + TS + Tailwind + Prisma + PostgreSQL в docker-compose (dev), ESLint/Prettier/Vitest, CI (lint, typecheck, test, build), токены из DESIGN.md, `basePath: '/admin'`.
**Приёмка:** `docker compose -f docker-compose.dev.yml up` + `npm run dev` открывает `http://localhost:3000/admin` с пустым AppShell в стиле km-dashboard; CI зелёный; `.env.example` без секретов.

### Фаза 1 — MVP (≈1–2 недели)
1. **Auth + 2FA**: логин, TOTP, резервные коды, сессии, reauth, `seed:owner`, rate limit, роли.
2. **Layout**: AppShell, сайдбар, шапка, тема, все UI-компоненты из DESIGN.md (страница `/admin/ui` — витрина компонентов, только в dev).
3. **Дашборд**: KPI, таблица сервисов, графики времени ответа и метрик сервера, алерты.
4. **Сервисы**: CRUD реестра, health-checks в worker, история, SSL-срок, генератор Traefik labels, Telegram при падении/подъёме.
5. **Доступы**: vault с AES-256-GCM, reveal с reauth, аудит, генератор паролей.
6. **SEO**: страницы, превью, sitemap/robots, ID счётчиков, публичные эндпоинты.
7. **Журнал действий**, **Пользователи** (приглашения, роли), **Telegram** (бот, тест, правила).
8. **Деплой-пакет**: `Dockerfile` (multi-stage, standalone, non-root), `docker-compose.yml` (app, worker, postgres, docker-socket-proxy read-only), Traefik labels для `vaybik.ru/admin`, `docs/DEPLOY.md` (пошагово для Алексея, бэкап/восстановление).
**Приёмка:**
- без 2FA owner не попадает дальше настройки 2FA; 6 неверных паролей → блокировка;
- добавленный сервис с `healthUrl` через ≤ 2 интервала показывает статус и время ответа; при остановке тестового сервиса приходит сообщение в Telegram, при подъёме — второе;
- секрет в БД нечитаем (проверка тестом: в `dataEnc` нет исходной строки), показ без reauth → 401, каждое раскрытие есть в журнале;
- `/admin/api/public/sitemap.xml` валиден и содержит страницы с `inSitemap=true`;
- партнёр не может получить чужие данные (e2e/unit тест на каждый партнёрский эндпоинт);
- Lighthouse (desktop) по `/admin` ≥ 90 Performance / Accessibility; unit-тесты crypto/auth/RBAC; e2e: логин+2FA, создание сервиса, создание и раскрытие секрета.

### Фаза 2. Управление Docker (≈1 неделя)
socket-proxy с ограниченным POST, статус/stats контейнеров, restart/start/stop с подтверждением, логи (tail + SSE), обновление (вариант A), denylist VPN/Traefik.
**Приёмка:** restart тестового контейнера из UI работает и пишется в журнал; попытка управлять контейнером не из реестра или из denylist → 403 (тест); логи стримятся без утечек памяти 10 мин; прокси не опубликован наружу.

### Фаза 3. Базы данных, бэкапы, метрики (≈1 неделя)
Подключения, размеры, read-only браузер, SELECT-консоль для owner, бэкапы по расписанию + ручные, restore с reauth, бэкап самой админки, интеграция Яндекс.Метрики (визиты на дашборд).
**Приёмка:** бэкап создаётся по cron и вручную, скачивается, восстанавливается на тестовую БД; `DELETE`/`UPDATE` в консоли отклоняются; запрос > 5 с прерывается.

### Фаза 4. Партнёры и интеграции (≈1 неделя)
Партнёры, кабинет партнёра, API-ключи (хеш, один показ), вебхуки с HMAC и ретраями, рефералы, `/ingest/lead` для сервисов (lead.vaybik.ru и др.).
**Приёмка:** вебхук подписан и проверяется примером кода из доков; отозванный ключ → 401; реферальный переход → заявка → начисление видны в кабинете партнёра.

### Фаза 5. Публичный хаб (опционально)
Публичная главная vaybik.ru из «Настроек Вайбика» + SEO + витрина сервисов (то же приложение или nginx по API), замена заглушки.
**Приёмка:** изменение контента в админке отражается на vaybik.ru ≤ 5 мин; SEO-метатеги совпадают с заданными.

## 12. Вне рамок
Биллинг клиентов, собственный CI/CD-сервер, управление DNS/Traefik/VPN, доступ к shell сервера из админки.
