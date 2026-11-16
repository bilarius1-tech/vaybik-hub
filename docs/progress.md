# Прогресс

## Фаза 0 — каркас
- [x] Next.js (App Router, TypeScript strict, ESLint, `src/`, npm)
- [x] `basePath: '/admin'`, `output: 'standalone'`
- [x] Tailwind + токены DESIGN.md (A/B/C + светлая), Manrope
- [x] Prisma: User, Session, Setting, AuditLog + первая миграция
- [x] AppShell (сайдбар 250px, sidefoot, sticky-шапка, тема, Segmented)
- [x] Страницы-заглушки по карте меню TZ §6
- [x] UI-компоненты + витрина `/admin/ui` (только dev)
- [x] Prettier, Vitest, Playwright smoke, worker-заглушка
- [x] GitHub Actions CI (lint, typecheck, test, build + postgres)
- [x] `docs/progress.md` с чек-листом

## Фаза 1 — Auth
- [x] Логин email+пароль (argon2id) → TOTP / резервный код
- [x] Сессии в БД, cookie Secure*/HttpOnly/SameSite=Strict/Path=/admin
- [x] Обязательная 2FA для OWNER/ADMIN
- [x] reauth, rate limit, RBAC, seed:owner, users/profile/activity

## Фаза 1 — Сервисы и дашборд
- [x] Модели Service, HealthCheck, ServerMetric, NotificationRule (+ throttle)
- [x] CRUD `/admin/services` (таблица, форма, страница с историей и графиком)
- [x] Worker pg-boss: health-checks, SSRF, SSL, агрегация; метрики `/host/proc`
- [x] Telegram: правила, анти-спам, тест (токен из env)
- [x] Генератор Traefik labels (YAML)
- [x] Дашборд KPI k5, таблица, Chart.js, алерты, sidefoot, период
- [x] `GET /admin/api/public/services`, `/admin/api/health`
- [x] Сид демо-сервисов (vaybik, region, chat/lead не развёрнуты)
- [x] Unit (checker/SSRF/labels) + e2e создать сервис

## Фаза 1 — Vault
- [x] Модель Secret, envelope AES-256-GCM (DEK + VAULT_MASTER_KEY), keyVersion
- [x] CRUD / список без секретов, reveal после reauth, автоочистка буфера 30 с
- [x] Генератор паролей, папки и теги, аудит раскрытий
- [x] `npm run vault:rotate`, Telegram-токен из vault (фолбэк env)
- [x] Тесты: нет plaintext в dataEnc; reveal без reauth → 401

## Фаза 1 — SEO
- [x] Модель SeoPage, CRUD, превью сниппета и OG (CalcCard-стиль), счётчики длины
- [x] JSON-LD, ID Вебмастера/Метрики/GSC в Setting
- [x] Публичные `/api/public/sitemap.xml`, `/api/public/robots.txt`
- [x] «Проверить страницу» с SSRF-защитой

## Фаза 1 — Настройки Вайбика
- [x] Бренд (название, слоган, логотип, фавикон, тема A/B/C)
- [x] Контент блоков публичного сайта, контакты
- [x] Загрузка файлов (MIME/размер), `GET /api/public/site` с кешем
- [ ] Деплой-пакет (Dockerfile, compose prod, DEPLOY.md)

## Фазы
- [x] Фаза 0 — каркас
- [ ] Фаза 1 — MVP (auth✓, сервисы+дашборд✓, vault✓, SEO✓, настройки✓, деплой-пакет)
- [ ] Фаза 2 — Docker
- [ ] Фаза 3 — БД и бэкапы
- [ ] Фаза 4 — партнёры
- [ ] Фаза 5 — публичный хаб (опц.)

## Факты сервера (Traefik / тема)
- Внешняя сеть Traefik: `proxy` (external)
- Entrypoints: `websecure` (https), `web` (http)
- Certresolver: `le`
- Редирект http→https: middleware `to-https@docker`
- Тема: вариант **A** (`NEXT_PUBLIC_THEME_VARIANT=A`)

\* Secure cookie включается при `NODE_ENV=production`.
