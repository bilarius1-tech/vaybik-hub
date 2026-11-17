# CONTEXT — память проекта Вайбик

> Читать в начале **каждого** чата и при «открой день». Обновлять при «закрой день» и сразу после любого важного решения.
> Здесь только факты и решения, без секретов. Последнее обновление: 2026-11-17 (переезд leadweb → vaybik.ru в работе; фаза 3 на проде).

## 1. Что такое Вайбик

- **vaybik.ru** — хаб студии Алексея Тимофеева (бывш. Lead-web, ребрендинг в Вайбик). Сам домен — хаб, сервисы живут на поддоменах.
- Команда: **Алексей** — владелец, бэкенд (15 лет опыта), новичок в терминале/Cursor → агент всё запускает сам; **Игорь** — фронтенд.
- Помощник вне Cursor: бот **Grok («Вайбик»)** в чате Алексея — может зайти на сервер по SSH, синхронизировать GitHub, завести доступы.
- **vaybik-hub** (этот репозиторий) — умная админка на https://vaybik.ru/admin: настройки и SEO Вайбика, логины/пароли (Vault), партнёры, дашборд сервисов, базы данных.

## 2. Архитектура

- Сервер: FirstVDS VPS `199.189.250.208` (`bilariuss.hlab.kz`), Ubuntu 24.04, 4 vCPU / 8 ГБ, Europe/Moscow. Пользователи `root` и `deploy` (агенты работают как `deploy`).
- Traefik v3.6 в `/opt/proxy` (не трогать): сеть `proxy`, entrypoints `web`/`websecure`, resolver `le`, middleware `to-https@docker`, wildcard DNS `*.vaybik.ru` → сервер.
- Каждый сервис — `/opt/apps/<имя>`, свой git, свой compose, без `ports:`; создаётся `new-project` из `/opt/apps/_template`. Общие правила сервера — `/opt/docs`.
- vaybik-hub: Next.js 16 (App Router, TS strict), `basePath: /admin`, standalone; Tailwind 4 (токены km-dashboard), Prisma + PostgreSQL 16, pg-boss worker, Zod, Chart.js, Vitest, Playwright. Auth: argon2id, TOTP (опционально), сессии в БД. Vault: AES-256-GCM envelope (`VAULT_MASTER_KEY`). Docker — через `docker-socket-proxy` + dockerode (фаза 2: POST=1, restart/start/stop/images; denylist Traefik/VPN).
- Dev: `/opt/vaybik-hub` + `vaybik-hub-postgres-1` + `npm run dev` (127.0.0.1:3000). Prod: `/opt/apps/vaybik-hub`, compose-проект `vaybik-hub-prod`, деплой `scripts/deploy-prod.sh`. Подробно — `docs/WORKFLOW.md`.
- Стиль UI: https://ztim2008.github.io/km-dashboard/ (копия `bilarius1-tech/km-dashboard`), тема A, акцент `#ff8a1f`. См. `docs/DESIGN.md`.

## 3. Сервисы и поддомены

| Адрес                         | Что                                                   | Где                     | Статус             |
| ----------------------------- | ----------------------------------------------------- | ----------------------- | ------------------ |
| https://vaybik.ru             | главный сайт (статика leadweb → nginx)                | `/opt/apps/vaybik-main`; исходник `/opt/vaybik-site-src` (репо leadweb); деплой `scripts/deploy-site.sh` | переезд leadweb (до «задеплой» — ещё заглушка) |
| https://vaybik.ru/admin       | админка vaybik-hub                                    | `/opt/apps/vaybik-hub`  | работает (фаза 2)  |
| https://region.vaybik.ru      | «Регион» (Битрикс, отдельная разработка)              | `/opt/apps/region`      | работает; **не трогать** |
| http://199.189.250.208/whoami | тест Traefik / Docker-панели (`vaybik.managed=true`)  | `/opt/apps/whoami`      | работает           |
| https://chat.vaybik.ru        | ИИ-ассистент для сайтов клиентов (виджет → DeepSeek → Telegram/MAX) | `/opt/vaybik-chat` (dev), прод позже `/opt/apps/vaybik-chat` | Фаза 0 docs; репо [vaybik-chat](https://github.com/bilarius1-tech/vaybik-chat); **не развёрнут** |
| lead.vaybik.ru                | сбор заявок (лиды → `/admin/api/ingest/lead`, фаза 4) | —                       | план, не развёрнут |

Не относится к Вайбику, не трогать отсюда: сайт стоматологии цауне-дентал.рф (хостинг HandyHost).

## 4. Текущее состояние (на 2026-11-17)

- Фазы 0–3 на проде. Прод: `8a4bb94`, откат-тег `prev-4d0ae06` (образ до финальных fix(deploy); для отката фазы 3 к фазе 2 удобнее `prev-39d8be0`). `REQUIRE_2FA=false`, `SESSION_REMEMBER_DAYS=30`.
- Владелец: `bilariuss@yandex.ru` (пароль у Алексея в хранилище, в документах не хранить).
- Прод-реестр: **Whoami** и **Вайбик (главная)**. **Region** не в реестре и не трогаем без согласия.
- Бэкапы: `/var/backups/vaybik` (uid 1001), клиент pg 16, `-Fc`. Ручной бэкап после деплоя OK (`admin/db-….dump.enc`).
- Яндекс.Метрика на дашборд — отложена.

## 5. Решения (кратко, новые — снизу)

- **2026-11-10** — домен vaybik.ru, сервер FirstVDS, Traefik + сеть `proxy`, сервисы на поддоменах через `new-project`.
- **2026-11-16** — vaybik.ru — хаб; одна админка на `/admin` (basePath), а не отдельный поддомен.
- **2026-11-16** — стек админки фиксирован (см. §2), стиль km-dashboard, тема A.
- **2026-11-16** — VPN на сервере (Amnezia/Xray) выключен по просьбе Алексея (экономия); конфиги не удалять.
- **2026-11-16** — прод: отдельный checkout `/opt/apps/vaybik-hub`, образ `vaybik-hub-prod`, откат по тегу `prev-<sha>`.
- **2026-11-16** — вход упрощён: 2FA необязательна (`REQUIRE_2FA=false`, включается в профиле), «Запомнить меня» на 30 дней (скользящая сессия). Риск осознан Алексеем.
- **2026-11-16** — агент сам пушит (deploy key) и сам деплоит через `scripts/deploy-prod.sh` после проверок; журнал `docs/devlog/ГГГГ-ММ-ДД.md`, ритуал дня — `docs/WORKFLOW.md`.
- **2026-11-16** — Docker фаза 2: вариант A (pull + recreate); stop/update требуют reauth; контейнеры только из реестра + denylist VPN/Traefik; label `vaybik.managed=true` рекомендуется.
- **2026-11-16** — `region` управляется отдельно (Битрикс); подключать к админке Docker только с согласия Алексея. Тестовый контур Docker — `whoami`.
- **2026-11-16** — `deploy-prod.sh` перед compose делает `unset DOCKER_HOST POSTGRES_* DATABASE_URL` (иначе shell/dev.env ломает прод).
- **2026-11-17** — бэкапы на хосте в `/var/backups/vaybik` (bind-mount, uid 1001); формат `pg_dump -Fc` + AES; restore из UI только в тестовый контейнер; region/чужие БД в реестр не добавляем.
- **2026-11-17** — Яндекс.Метрику на дашборд переносим; приоритет фазы 3 — бэкапы.
- **2026-11-17** — `deploy-prod.sh`: хостовый `docker compose` через `env -u DOCKER_HOST` (в прод-.env DOCKER_HOST нужен контейнерам); grep `BACKUPS_HOST_DIR` не валит скрипт.
- **2026-11-17** — сервис **chat.vaybik.ru**: отдельный репо `bilarius1-tech/vaybik-chat`, рабочая копия `/opt/vaybik-chat`; Фаза 0 (проектирование) в docs; код/прод не поднимали.
- **2026-11-17** — главный сайт vaybik.ru: статика из `bilarius1-tech/leadweb` (`/opt/vaybik-site-src`), выкладка `scripts/deploy-site.sh` в `/opt/apps/vaybik-main` (nginx reload). `/admin` остаётся хабом (Traefik priority 100). URL: `/automation.html`→`/avtomatizaciya-1c/`, `/bitrix.html`→`/bitrix/` (301).
- **2026-11-17** — CMS-1 в хабе: Page/Block/NavItem/Redirect/PageRevision, `/admin/site`, предпросмотр, импорт leadweb. Публичный рендер из БД — позже (часть 3). Новый env: `SITE_ASSETS_ORIGIN`.

## 6. Договорённости

- Общение, документы, UI, описания коммитов — по-русски; код и префиксы коммитов — по-английски.
- Работа в `main` маленькими коммитами; каждый проходит lint + typecheck + test.
- Алексей не запускает команды сам — всё делает агент и объясняет простыми словами.
- Секреты только в `.env` (chmod 600) и Vault админки; в git/чат/devlog — никогда.

## 7. Открытые вопросы

- Telegram-бот для алертов: создать бота и указать chat id (нужен Алексей).
- По желанию: `vaybik.managed=true` на `vaybik-main` (сейчас без label — compose не трогали). `region` в реестр — только после согласия Алексея.
- Lighthouse ≥ 90 на `/admin` — не измерен.
- chat.vaybik.ru: ТЗ v0.3 в репо vaybik-chat, Фаза 0 спроектирована (ждём «да» на Фазу 1). lead.vaybik.ru — ТЗ ещё нет.
- 2FA для владельца: включить позже, когда будет удобно.

## 8а. Сайт / CMS (часть 1, 2026-11-17)

- Модели: `Page`, `Block`, `NavItem`, `Redirect`, `PageRevision`; SEO через связь `Page.seoPageId` → `SeoPage` (поля SEO не дублируются).
- Админка: `/admin/site`, редактор `/admin/site/pages/[id]`, предпросмотр `/admin/site-preview/[id]` (noindex, CSS с `SITE_ASSETS_ORIGIN`).
- Импорт: `npm run cms:import -- --src /opt/vaybik-site-src` (`--dry-run`, `--force`, `--only=/path/`). На проде — через временную папку в worker (см. промпт CMS-1 §9).
- Публичный vaybik.ru пока статика leadweb; рендер из БД — часть 3.
- Санитайзер: `sanitize-html` в `src/server/cms/sanitize.ts`.

## 8. Следующие шаги

1. CMS-1: «задеплой» хаба (миграция + `SITE_ASSETS_ORIGIN`) → бэкап → импорт на прод после «да».
2. CMS-2: Tiptap + медиагалерея (вместо JSON-редактора блоков).
3. chat.vaybik.ru — Фаза 1 после «да» по DESIGN (не трогать region/proxy).
4. Яндекс.Метрика на дашборд (отложено).
5. Промпт 8 — партнёры и лиды.
6. По желанию: Telegram-бот; 2FA владельцу.
