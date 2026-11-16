# Промпты для агентов Cursor (по порядку)

Как пользоваться: открыть папку репозитория в Cursor → новый чат агента (`Ctrl+L`, затем `Ctrl+N`) → режим **Agent** → вставить промпт текущей фазы целиком. Следующий промпт — только после того, как вы проверили результат предыдущего по критериям приёмки (`docs/TZ.md` §11). Каждый промпт можно запускать в новом чате.

---

## Промпт 1 — Фаза 0: каркас проекта

```
Ты работаешь в репозитории vaybik-hub — админка хаба Вайбик (https://vaybik.ru/admin).
Сначала внимательно прочитай AGENTS.md, docs/TZ.md, docs/DESIGN.md и правила в .cursor/rules. Соблюдай их всегда.

Задача — Фаза 0 (каркас), см. docs/TZ.md §11:
1. Создай в корне Next.js-приложение (актуальная стабильная версия, App Router, TypeScript strict, ESLint, src/-директория, npm) с basePath '/admin' и output 'standalone'. Не удаляй существующие docs/, AGENTS.md, .cursor/, README.md, docker-compose*.yml, .env.example — дополняй их.
2. Подключи Tailwind и перенеси токены из docs/DESIGN.md (вариант A по умолчанию, плюс варианты B, C и светлая тема) в CSS-переменные + конфиг Tailwind. Шрифт Manrope через next/font (latin+cyrillic).
3. Prisma + PostgreSQL: prisma/schema.prisma пока с моделями User, Session, Setting, AuditLog (из TZ §7), первая миграция. docker-compose.dev.yml уже есть — используй его для локальной БД.
4. Сделай AppShell в стиле km-dashboard: сайдбар 250px с брендом «Вайбик / панель управления» (плейсхолдер логотипа-кота), пункты меню из TZ §6 (страницы-заглушки с EmptyState), sidefoot с тремя строками-заглушками, sticky-шапка с live-точкой, Segmented (День/Неделя/Месяц), кнопкой «◐ Тема» (localStorage) и бейджем окружения. Мобильная версия ≤950px.
5. Базовые UI-компоненты из DESIGN.md §4: Card, CardHeader, Kpi, Pill, Insight, Alert, Button, Segmented, Field/Input/Select, DataTable (простая), Sparkline, StatusDot, EmptyState, Skeleton. Страница /admin/ui (только в dev) — витрина всех компонентов с демо-данными, включая карточку-калькулятор в стиле секции #sec-calc km-dashboard.
6. Инструменты: Prettier, Vitest (пример теста), скрипты npm: dev, build, start, lint, typecheck, test, test:e2e (Playwright, один smoke-тест открытия /admin), worker (пока заглушка src/worker/index.ts).
7. GitHub Actions CI: npm ci, lint, typecheck, test, build (с сервисом postgres).
8. Заведи docs/progress.md с чек-листом фаз и отметь выполненное по Фазе 0.

Ограничения: не подключайся к серверу, ничего не деплой, не коммить секреты. Маленькие коммиты (Conventional Commits), каждый проходит lint+typecheck+test.
Готово, когда: `docker compose -f docker-compose.dev.yml up -d && npm install && npx prisma migrate dev && npm run dev` открывает http://localhost:3000/admin с AppShell в стиле km-dashboard, /admin/ui показывает компоненты, CI зелёный. В конце дай краткий отчёт на русском: что сделано, как запустить, что осталось вопросом.
```

---

## Промпт 2 — Фаза 1a: аутентификация, 2FA, пользователи

```
Прочитай AGENTS.md, docs/TZ.md (§4, §5.8–5.10, §9) и docs/progress.md. Фаза 0 завершена.
Задача — Фаза 1, часть «Auth»:
- логин email+пароль (argon2id), второй шаг TOTP (otplib) или резервный код; сессии в БД (хеш токена), cookie Secure/HttpOnly/SameSite=Strict/Path=/admin, срок 12 ч скользящий;
- обязательная настройка 2FA для OWNER/ADMIN (QR + 10 резервных кодов, хеши), до настройки — только /admin/setup-2fa;
- reauth (пароль+TOTP → reauthUntil +5 мин) и helper requireReauth();
- rate limit и блокировка после 5 неудачных попыток на 15 мин (по email и IP);
- middleware защиты /admin/*, helper requireRole()/can();
- npm run seed:owner (интерактивный ввод email/пароля);
- /admin/users: приглашения по одноразовой ссылке (48 ч), роли, блокировка, активные сессии с завершением; /admin/profile: смена пароля, 2FA, сессии;
- AuditLog на все действия auth и пользователей, страница /admin/activity с фильтрами;
- проверка Origin для мутаций, заголовки безопасности (CSP, HSTS, X-Frame-Options и др. из TZ §9).
Тесты: unit на хеширование, TOTP, RBAC, блокировку; e2e: вход с 2FA, выход, блокировка.
Маленькие коммиты, обнови docs/progress.md. В конце — отчёт на русском.
```

---

## Промпт 3 — Фаза 1b: реестр сервисов, health-checks, дашборд, Telegram

```
Прочитай AGENTS.md, docs/TZ.md (§5.1, §5.2, §5.11, §7, §8) и docs/progress.md.
Задача — Фаза 1, часть «Сервисы и дашборд»:
- модели Service, HealthCheck, ServerMetric, NotificationRule; CRUD /admin/services (список-таблица со StatusDot, спарклайном и аптаймом; форма создания/редактирования; страница сервиса с историей проверок и графиком времени ответа);
- worker на pg-boss: HTTP(S)-проверки по интервалу (код, время, ключевое слово, срок SSL), защита от SSRF, агрегация старых данных; метрики сервера из /host/proc (read-only) раз в минуту;
- смена статуса → событие → Telegram (токен бота хранится пока в env TELEGRAM_BOT_TOKEN, позже переедет в vault), правила и анти-спам, кнопка «Отправить тест»;
- генератор Traefik labels для сервиса (поддомен, порт, сеть, certresolver из env) — вывод YAML для копирования;
- дашборд /admin: KPI k5, таблица сервисов, графики (Chart.js), алерты «Внимание», sidefoot с живыми данными, переключатель периода;
- публичный GET /admin/api/public/services и /admin/api/health.
Заполни сидом демо-сервисы: vaybik.ru, region.vaybik.ru, chat.vaybik.ru, lead.vaybik.ru (последние два помечены «не развёрнут»).
Тесты: unit на чекер и SSRF-фильтр, e2e: создать сервис → увидеть статус. Маленькие коммиты, отчёт на русском.
```

---

## Промпт 4 — Фаза 1c: Доступы (vault), SEO, Настройки Вайбика

```
Прочитай AGENTS.md, docs/TZ.md (§5.3, §5.4, §5.5, §9) и docs/progress.md.
Задача — Фаза 1, часть «Vault, SEO, Настройки»:
- Vault: модель Secret, envelope encryption AES-256-GCM (DEK на запись, мастер-ключ VAULT_MASTER_KEY base64 32 байта из env, keyVersion), список без секретов, просмотр/копирование только после reauth с автоочисткой буфера 30 с, генератор паролей, папки и теги, аудит каждого раскрытия, скрипт npm run vault:rotate. Перенеси токен Telegram в vault (с фолбэком на env). Тест: в БД нет открытого текста, reveal без reauth → 401.
- SEO: модель SeoPage, CRUD, превью сниппета Яндекс/Google и OG-карточки (в стиле CalcCard), счётчики длины, JSON-LD, ID Яндекс.Вебмастера/Метрики/GSC в Setting, публичные /admin/api/public/sitemap.xml и /robots.txt, «проверить страницу» (с SSRF-защитой).
- Настройки Вайбика: бренд (название, слоган, логотип, фавиконы, вариант темы A/B/C), контент блоков публичного сайта, контакты, загрузка файлов (MIME/размер), публичный /admin/api/public/site с кешем.
Маленькие коммиты, обнови progress.md, отчёт на русском.
```

---

## Промпт 5 — Фаза 1d: деплой-пакет и приёмка MVP

```
Прочитай AGENTS.md, docs/TZ.md (§3, §9, §11 Фаза 1) и docs/progress.md.
Задача — завершить MVP:
- Dockerfile (multi-stage, standalone, non-root, healthcheck), команда для worker из того же образа;
- docker-compose.yml для прод: app, worker, postgres (volume), docker-socket-proxy (CONTAINERS=1, INFO=1, POST=0, во внутренней сети, без портов); app в внешней сети Traefik с labels: Host(`vaybik.ru`) && PathPrefix(`/admin`), приоритет выше роутера заглушки, certresolver и имя сети — из .env; /proc хоста read-only в worker;
- ежедневный бэкап БД админки и uploads (зашифрованный, 14 дней);
- docs/DEPLOY.md для человека: пошагово (клонирование в /opt/vaybik-hub, .env, генерация ключей командами openssl, docker compose up -d, seed:owner, проверка, обновление, бэкап/восстановление), с явным предупреждением не трогать VPN, acme.json, конфиг Traefik;
- пройди все критерии приёмки Фазы 1 из TZ §11, допиши недостающие тесты, Lighthouse-проверку описать в progress.md.
Ничего не деплой и не подключайся к серверу. Отчёт на русском: что готово, чек-лист приёмки, команды деплоя.
```

---

## Промпт 6 — Фаза 2: управление Docker

```
Прочитай AGENTS.md, docs/TZ.md (§5.2, §8.3, §9 п.8, §11 Фаза 2) и docs/progress.md.
Задача — Фаза 2: через dockerode → docker-socket-proxy (обнови env прокси: POST=1, ALLOW_RESTARTS=1, ALLOW_START=1, ALLOW_STOP=1, IMAGES=1, остальное 0):
- статус, uptime, CPU/RAM контейнеров сервиса; restart/start/stop с ConfirmDialog (stop — с reauth); обновление по варианту A (pull образа из GHCR + recreate с прежними параметрами);
- логи: tail + поток SSE, фильтр, скачивание; LogViewer;
- жёсткий whitelist (только контейнеры из реестра / label vaybik.managed=true) и denylist (traefik, amnezia*, xray*, wg*) с тестами → 403;
- все действия в AuditLog и Telegram.
Обнови DEPLOY.md (как пометить контейнеры label vaybik.managed=true). Маленькие коммиты, отчёт на русском.
```

---

## Промпт 7 — Фаза 3: базы данных, бэкапы, Метрика

```
Прочитай AGENTS.md, docs/TZ.md (§5.7, §5.12, §11 Фаза 3) и docs/progress.md.
Задача — Фаза 3:
- DbConnection (учётка read-only — ссылка на запись vault), список БД с размерами и ростом, таблицы и крупнейшие таблицы;
- read-only браузер (пагинация, фильтр, схема), SELECT-консоль для OWNER (read-only транзакция, statement_timeout 5s, лимит 500 строк, отказ на не-SELECT);
- бэкапы по cron и вручную (pg_dump/mysqldump, сжатие, шифрование, ретенция), скачивание, restore только OWNER + reauth + предварительный бэкап, Telegram при ошибке;
- интеграция Яндекс.Метрики (токен в vault): визиты на дашборд.
Тесты на запрет мутаций в консоли и таймаут. Маленькие коммиты, отчёт на русском.
```

---

## Промпт 8 — Фаза 4: партнёры и интеграции

```
Прочитай AGENTS.md, docs/TZ.md (§5.6, §8, §11 Фаза 4) и docs/progress.md.
Задача — Фаза 4:
- Partner, ApiKey (показ ключа один раз, в БД SHA-256 + префикс, scopes, срок, отзыв), Webhook (HMAC-SHA256 в X-Vaybik-Signature, ретраи с backoff в worker, журнал доставок, «тест»), Referral (?ref=CODE, cookie 30 дней, начисления);
- роль PARTNER и кабинет /admin/partner только со своими данными (тесты изоляции на каждый эндпоинт);
- POST /admin/api/ingest/lead по API-ключу — приём заявок из сервисов (lead.vaybik.ru и др.), заявки на дашборде;
- docs/INTEGRATIONS.md: как сервису/партнёру отправлять заявки и проверять подпись вебхука (пример на Node и PHP).
Маленькие коммиты, отчёт на русском.
```

---

## Промпт 9 — Фаза 5 (опционально): публичный хаб vaybik.ru

```
Прочитай AGENTS.md, docs/TZ.md (§5.3, §5.4, §11 Фаза 5) и docs/progress.md.
Задача — предложить и реализовать замену заглушки vaybik.ru публичной главной, которая берёт контент из «Настроек Вайбика», SEO из модуля SEO и витрину сервисов из реестра. Стиль — бренд Вайбика (тёплая тёмная тема, #ff8a1f, кот-маскот). Сначала напиши в docs/progress.md 2 варианта (то же Next-приложение без basePath для публичной части vs отдельный статический сайт, собираемый по API) и выбери по умолчанию первый, если нет возражений. Ничего не деплой. Отчёт на русском.
```
