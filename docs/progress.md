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
- [x] Telegram: правила, анти-спам, тест (токен из env → vault)
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

## Фаза 1 — Деплой-пакет
- [x] Dockerfile multi-stage, standalone, non-root, healthcheck; worker из того же образа (`node worker.cjs`)
- [x] `docker-compose.yml`: app, worker, postgres (volume), docker-socket-proxy (CONTAINERS/INFO, POST=0, без портов); Traefik labels; `/proc` ro в worker; volumes uploads/backups
- [x] Ежедневный бэкап БД+uploads (AES-256-GCM, 14 дней), `npm run backup:now` / restore-скрипт
- [x] `docs/DEPLOY.md` пошагово + предупреждения VPN/acme/Traefik

## Фаза 1 — Чек-лист приёмки (TZ §11)

| Критерий | Статус | Как проверить |
|---|---|---|
| OWNER/ADMIN без 2FA → только setup-2fa | ✅ | unit `gate.test.ts`; e2e login; вручную после seed:owner |
| Блокировка после 5 неверных паролей (6-я отклонена) | ✅ | e2e `auth.spec.ts`; unit rate-limit |
| Сервис с healthUrl → статус ≤ 2 интервала; Telegram down/up | ✅ код | worker 1 мин; проверка на стенде с реальным ботом |
| Секрет в БД нечитаем; reveal без reauth → 401; аудит | ✅ | unit vault crypto/service + reveal-auth |
| `/admin/api/public/sitemap.xml` валиден, только `inSitemap` | ✅ | unit sitemap + sitemap-public; curl после деплоя |
| Партнёр не видит чужие данные | ✅ RBAC | unit `partner-isolation` (эндпоинты партнёра — Фаза 4) |
| Unit crypto/auth/RBAC | ✅ | vitest |
| e2e: логин+2FA, сервис, секрет | ✅ | `auth`, `services`, `vault` specs |
| Lighthouse desktop `/admin` ≥ 90 Perf/A11y | 📋 вручную | см. ниже |

### Lighthouse (вручную после деплоя / локально)

Автопрогон в CI не делаем (нужна авторизованная сессия и стабильный UI). После входа владельца:

```bash
# Chrome: DevTools → Lighthouse → Desktop → Performance + Accessibility
# URL: https://vaybik.ru/admin  (или http://127.0.0.1:3000/admin после логина)
# Цель: Performance ≥ 90, Accessibility ≥ 90
```

Либо CLI (нужен cookies/storage авторизованной сессии):

```bash
npx lighthouse http://127.0.0.1:3000/admin --preset=desktop --only-categories=performance,accessibility --view
```

Результат прогона зафиксировать здесь при приёмке на стенде:

- Дата:
- Perf:
- A11y:
- Замечания:

## Фазы
- [x] Фаза 0 — каркас
- [x] Фаза 1 — MVP (auth, сервисы, vault, SEO, настройки, деплой-пакет)
- [ ] Фаза 2 — Docker
- [ ] Фаза 3 — БД и бэкапы (расширенные; ежедневный бэкап админки уже в фазе 1)
- [ ] Фаза 4 — партнёры
- [ ] Фаза 5 — публичный хаб (опц.)

## Факты сервера (Traefik / тема)
- Внешняя сеть Traefik: `proxy` (external)
- Entrypoints: `websecure` (https), `web` (http)
- Certresolver: `le`
- Редирект http→https: middleware `to-https@docker`
- Тема: вариант **A** (`NEXT_PUBLIC_THEME_VARIANT=A`)
- Приоритет роутера admin: `TRAEFIK_ADMIN_PRIORITY=100`

\* Secure cookie включается при `NODE_ENV=production`.
