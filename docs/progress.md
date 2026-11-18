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
- [x] Обязательная 2FA для OWNER/ADMIN (отключаемо: `REQUIRE_2FA=false`, на проде сейчас false)
- [x] «Запомнить меня» — сессия `SESSION_REMEMBER_DAYS` (30 дн.), скользящая, cookie с Max-Age; reauth без 2FA — только пароль
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

## Фаза 2 — Docker
- [x] socket-proxy: POST=1, ALLOW_RESTARTS/START/STOP=1, IMAGES=1, остальное 0
- [x] dockerode-клиент через DOCKER_HOST; whitelist (реестр) + denylist (traefik/amnezia/xray/wg)
- [x] Статус/uptime/CPU/RAM; restart/start/stop (stop+update → reauth); update = pull+recreate
- [x] Логи: tail, SSE-поток, фильтр, скачивание; LogViewer + ConfirmDialog
- [x] AuditLog + Telegram на docker.*
- [x] Тесты policy → 403; DEPLOY.md про `vaybik.managed=true`
- [x] Прод 2026-11-16: `deploy-prod.sh` (proxy POST=1), Whoami в реестре + `vaybik.managed=true`
- [x] Проверки: `/admin/api/health`, vaybik.ru, region.vaybik.ru → 200; whoami status/logs/restart OK; traefik denylist 403; region не в реестре 403
- [x] **Region не подключать** (Битрикс, другой агент) — только с согласия Алексея
- [x] `vaybik-main` в прод-реестре (STATIC, container `vaybik-main`, health https://vaybik.ru); compose не меняли

## Фаза 3 — БД и бэкапы
- [x] Фикс admin-backup: URL без `schema`, `pg_dump -Fc`, клиент Postgres 16, без секретов в логах
- [x] Хранение `/var/backups/vaybik` (bind-mount), mkdir/chown в deploy-prod.sh
- [x] Модели `DbConnection`, `DbSizeSnapshot`, `Backup` + миграция
- [x] Реестр подключений (авто «Админка Вайбик»), размеры, график роста
- [x] Read-only браузер таблиц (timeout 5 с, лимит 500)
- [x] SELECT-консоль OWNER + запрет мутаций (тесты)
- [x] Расписание / ручной бэкап / sha256 / verify / скачивание .enc + reauth
- [x] Тестовый restore (API + `scripts/backup-restore-test.ts`); в прод из UI нельзя
- [x] DEPLOY.md §8, RBAC-тесты, политика region/prod
- [ ] Яндекс.Метрика на дашборд — перенос (не хватило приоритета; бэкапы важнее)
- [x] Деплой фазы 3 — `8a4bb94`, health 200, ручной бэкап OK → `/var/backups/vaybik/admin`

## Фаза 5 / CMS-1 — страницы, блоки, меню, редиректы (часть 1 из 4)

Промпт: `docs/prompts/10-cms-01-pages.md`. Публичный vaybik.ru остаётся статикой leadweb.

- [x] refactor: `NavItem` (сайдбар) → `SidebarItem`
- [x] RBAC Action `content.manage` (OWNER+ADMIN) + тесты
- [x] Prisma: Page, Block, NavItem, Redirect, PageRevision + enums; связь Page↔SeoPage
- [x] Миграция `cms_pages_blocks_nav` (только добавление)
- [x] Схемы блоков + санитайзер + unit-тесты XSS
- [x] API: pages / blocks / publish / revisions / nav / redirects
- [x] Админка `/admin/site` + редактор `/site/pages/[id]`
- [x] Предпросмотр `/admin/site-preview/[id]` (noindex, без JS сайта)
- [x] Импортёр `scripts/cms-import-leadweb.ts` + `npm run cms:import`
- [x] e2e `site.spec.ts`; повторный импорт = 0 изменений (dev)
- [x] Документация CONTEXT; деплой + импорт на прод (2026-11-17)

## CMS-2 — формы блоков, Tiptap, медиабиблиотека (часть 2 из 4)

Промпт: `docs/prompts/11-cms-02-editor-media.md`. Публичный vaybik.ru остаётся статикой.

- [x] Медиа: MediaFolder / MediaAsset / MediaUsage + миграция `cms_media`
- [x] Медиа: sharp, варианты, public URL, API upload/list/replace/delete
- [x] Медиа: вкладка «Медиа» + MediaPicker
- [x] Tiptap RichText + sanitizeRichText + миграция полей
- [x] Формы блоков вместо JSON + live preview iframe
- [x] rawHtml → типы iconList/offer/beforeAfter + `cms-convert-rawhtml` (dry-run: 3/12; keysy остаётся)
- [x] Бэкап uploads v2 (потоковое AES, magic VBK2; decrypt понимает v1 и v2) + soft-limit в UI
- [x] Тесты lint/typecheck/test/build + e2e site-media; деплой — только после «задеплой»
- [ ] CMS-2b (позже): + между блоками, библиотека секций, drag-and-drop, клик-для-правки в предпросмотре

## CMS-2.1 — списки /admin/site (страницы, медиа, меню, редиректы)

- [x] Page.deletedAt (soft delete) + partial unique path; updatedBy → User
- [x] Список страниц: действия, сортировка, пагинация в URL, поиск debounce, фильтры, bulk, «Изменил», корзина
- [x] API: list/sort/paginate, trash/restore/purge, duplicate, unpublish, bulk + audit
- [x] Меню/редиректы: create в модалке, действия; медиа: «Найдено» + сброс
- [x] Unit + e2e; lint/typecheck/test/build
- [x] Деплой CMS-2.1 на прод (`680e299`, миграция `cms_pages_soft_delete`, `Page_path_active_key` OK)

## CMS-3 — публичный vaybik.ru из БД (часть 3 из 4)

Промпт: `docs/prompts/12-cms-03-public-render.md`. Публичный vaybik.ru = CMS (`SITE_PROD_PRIORITY=50`).

- [x] Общий код: visibility / load / renderSiteDocument(mode public|preview); шаблон keysy
- [x] Site-сервер `src/site/server.ts` → `dist/site.cjs`; сервис `site` в compose (порт 3100, cache volume)
- [x] Маршруты: healthz, media, sitemap/robots/llms, redirects, slash/index, CMS-страницы, proxy → vaybik-main
- [x] Паритет разметки с leadweb (head/шапка/подвал/виджеты/медиа picture); 404
- [x] Кеш HTML+gzip/br + `site.contentVersion` / bumpSiteVersion на мутациях
- [x] Админка: бейдж неопубликованных изменений, unpublish, «Открыть на сайте» → vaybik.ru
- [x] Traefik: site на vaybik.ru; роутер site-test снят; `scripts/site-cutover.sh` on/off/status/--force
- [x] `scripts/site-parity.ts`; реестр сервиса; seed robots/llms/assets; template keysy
- [x] vitest + e2e site-public; lint/typecheck/test/build
- [x] Деплой A: тестовый хост (позже снят); роль БД `vaybik_site`
- [x] Cutover ON (вечер 17.11): `SITE_PROD_PRIORITY=50`, origin `https://vaybik.ru`
- [x] robots.txt / llms.txt только из `/admin/seo`; статика удалена из leadweb и nginx
- [x] Виджет ИИ-консультанта (`site.chatWidget`); CSP-RO + chat.vaybik.ru; на всём сайте
- [x] `deploy-prod.sh` / `site-cutover.sh`: unset `SITE_*` (не сбрасывать cutover)

## CMS-3a — калькуляторы + DOM-parity (продолжение CMS-3)

Промпт: `docs/prompts/13-cms-03a-calc-form.md`.

- [x] calcMini всегда из `widgets/calcMini.html` (+ `showMore` / детект `calc-more`)
- [x] sanitize: `viewBox` / `preserveAspectRatio` (parser без lowerCaseAttributeNames)
- [x] Рендер: `fixMissingSvgViewBox` для уже сохранённых svg; скрипт `cms-repair-svg-viewbox.ts` (на прод — после «да»)
- [x] calculator assets: calc.css + data/content/calc/client.js; `afterMain` = lc-bar
- [x] Двойной hero: skip `hero` при widget calcFull; подсказка в редакторе
- [x] Header: без дубля «Обсудить проект»; `sub-uslugi`/`sub-auto`; aria-current; mascot picture; FAQ/карточки svg
- [x] Parity: DOM header/main/footer + #calc-sec + lc-bar + css/js + svg viewBox (гонка DOM остановлена)
- [x] lint / typecheck / test / build зелёные
- [x] Деплой + cutover vaybik.ru (`e613dd7`, вечер 17.11)

## Клиенты ↔ продукт «Чат» (2026-11-18)

План: `docs/plans/2026-11-18-services-clients-access.md`. Промпт 8 (PARTNER) отложен; Client ≠ Partner.

- [x] Ф0 — план (модели, контракт, фазы, риски миграций)
- [ ] Ф-A — Service.isProduct/manageUrl; Client + ClientService; RBAC `clients.manage`; UI `/admin/clients`; connect Chat (HMAC); AuditLog; фильтр продуктов
- [ ] Ф-B — «Войти как клиент» (SSO token + jti, AuditLog `client.impersonate`, без подмены cookie хаба)
- [ ] Этап 2 — кабинет CLIENT / ClientMember / Invite (только план, код позже)
- [ ] Env на стенде/проде (Алексей): `CHAT_BASE_URL`, `HUB_CHAT_API_SECRET`, `HUB_CHAT_SSO_SECRET`

## Фазы
- [x] Фаза 0 — каркас
- [x] Фаза 1 — MVP (auth, сервисы, vault, SEO, настройки, деплой-пакет)
- [x] Фаза 2 — Docker
- [x] Фаза 3 — БД и бэкапы (код готов; деплой и Метрика — отдельно)
- [ ] Фаза 4 — партнёры (**отложена**; не смешивать с Client)
- [x] Фаза 5 / CMS-3+3a — публичный сайт из БД (cutover ON; источник правды — админка)

## Факты сервера (Traefik / тема)
- Внешняя сеть Traefik: `proxy` (external)
- Entrypoints: `websecure` (https), `web` (http)
- Certresolver: `le`
- Редирект http→https: middleware `to-https@docker`
- Тема: вариант **A** (`NEXT_PUBLIC_THEME_VARIANT=A`)
- Приоритет роутера admin: `TRAEFIK_ADMIN_PRIORITY=100`

\* Secure cookie включается при `NODE_ENV=production`.
