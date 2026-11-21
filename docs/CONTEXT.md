# CONTEXT — память проекта Вайбик

> Читать в начале **каждого** чата и при «открой день». Обновлять при «закрой день» и сразу после любого важного решения.
> Здесь только факты и решения, без секретов. Последнее обновление: 2026-11-21 (закрытие дня: SSO-кнопки чата + Дизайн Атлас на /admin/services).

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
| https://vaybik.ru             | главный сайт (CMS `site.cjs`; статика css/js/img — nginx) | хаб `/opt/apps/vaybik-hub` + `/opt/apps/vaybik-main` (css/js/fonts/img/kp); тексты — админка | cutover ON |
| https://vaybik.ru/admin       | админка vaybik-hub                                    | `/opt/apps/vaybik-hub`  | работает (фаза 2)  |
| https://region.vaybik.ru      | «Регион» (Битрикс, отдельная разработка)              | `/opt/apps/region`      | работает; **не трогать** |
| http://199.189.250.208/whoami | тест Traefik / Docker-панели (`vaybik.managed=true`)  | `/opt/apps/whoami`      | работает           |
| https://chat.vaybik.ru        | ИИ-ассистент (виджет на vaybik.ru + сервис чата) | репо [vaybik-chat](https://github.com/bilarius1-tech/vaybik-chat); виджет с хаба (`site.chatWidget`) | прод виджета на главной vaybik.ru |
| https://design.vaybik.ru      | Дизайн Атлас (сайт + /primer)                    | внешний; в реестре хаба `design-atlas` | сайт 200; DNS/Traefik не трогаем из хаба |
| https://lead.vaybik.ru        | «Лиды Профи/YouDo» — внутренний кабинет студии       | репо [vaybik-leads](https://github.com/bilarius1-tech/vaybik-leads); в хабе slug `lead` | SSO хаба готово; сервис собирает другой агент |

Не относится к Вайбику, не трогать отсюда: сайт стоматологии цауне-дентал.рф (хостинг HandyHost).

## 4. Текущее состояние (на 2026-11-21)

- Фазы 0–3 + CMS-3a на проде. Публичный **vaybik.ru = CMS** (`SITE_PROD_PRIORITY=50`). `REQUIRE_2FA=false`, `SESSION_REMEMBER_DAYS=30`.
- Хаб-образ **`33a5061`**: SSO-кнопки чата + «Дизайн Атлас» на `/admin/services`. Ранее: serviceCards (`469599e`), landing-clients (`9b51258`), SSO (`222db91`).
- Главная: офис/studio снят с `/` (виджет `studio` в коде сохранён); три карточки сервисов + медиа. CSS leadweb `29aaee3`.
- Клиенты↔Чат: connect/sync, срок, удаление, статус autosave; impersonate → 200 `{redirectUrl}`; SSO `mode=client`; лендинг DEMO→ACTIVE → хаб. Виджет — `site.chatWidget` (весь сайт).
- Доступ клиента: Invite 72 ч, `/my-services`, «Скопировать сообщение», письмо-приглашение; галочка «Отправлять письма»; cron срока 09:00 MSK.
- **Прод env:** только `/opt/apps/vaybik-hub/.env` (compose `env_file: .env`). Dev — `/opt/vaybik-hub/.env`. Секреты SMTP не путать между ними.
- **Источник правды — админка.** Промпт 8 (PARTNER) отложен; Client ≠ Partner. Кабинет-аналитика — позже.
- Деплой/cutover: всегда unset `POSTGRES_*` и `SITE_PROD_PRIORITY`/`SITE_PUBLIC_ORIGIN` из shell.
- Владелец: `bilariuss@yandex.ru` (пароль у Алексея в хранилище, в документах не хранить).
- Прод-реестр: **Whoami**, **Вайбик (главная)**, CMS site, **Вайбик Чат**, **Дизайн Атлас**. **Region** не трогаем без согласия.
- Бэкапы: `/var/backups/vaybik` (uid 1001). Яндекс.Метрика — отложена.

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
- **2026-11-17** — То же для `SITE_PROD_PRIORITY` / `SITE_PUBLIC_ORIGIN`: Cursor/shell может подставить `SITE_PROD_PRIORITY=1` → compose labels priority=1 → cutover молча откатывается на nginx. `deploy-prod.sh` и `site-cutover.sh` unset'ают эти ключи; значения только из прод-`.env`.
- **2026-11-17** — бэкапы на хосте в `/var/backups/vaybik` (bind-mount, uid 1001); формат `pg_dump -Fc` + AES; restore из UI только в тестовый контейнер; region/чужие БД в реестр не добавляем.
- **2026-11-17** — Яндекс.Метрику на дашборд переносим; приоритет фазы 3 — бэкапы.
- **2026-11-17** — `deploy-prod.sh`: хостовый `docker compose` через `env -u DOCKER_HOST` (в прод-.env DOCKER_HOST нужен контейнерам); grep `BACKUPS_HOST_DIR` не валит скрипт.
- **2026-11-17** — сервис **chat.vaybik.ru**: отдельный репо `bilarius1-tech/vaybik-chat`, рабочая копия `/opt/vaybik-chat`; Фаза 0 (проектирование) в docs; код/прод не поднимали.
- **2026-11-17** — главный сайт vaybik.ru: статика из `bilarius1-tech/leadweb` (`/opt/vaybik-site-src`), выкладка `scripts/deploy-site.sh` в `/opt/apps/vaybik-main` (nginx reload). `/admin` остаётся хабом (Traefik priority 100). URL: `/automation.html`→`/avtomatizaciya-1c/`, `/bitrix.html`→`/bitrix/` (301).
- **2026-11-17** — CMS-1 в хабе: Page/Block/NavItem/Redirect/PageRevision, `/admin/site`, предпросмотр, импорт leadweb. Публичный рендер из БД — позже (часть 3). Новый env: `SITE_ASSETS_ORIGIN`.
- **2026-11-17** — CMS-2.1: soft delete страниц + списки `/admin/site` (сортировка/пагинация/URL/bulk/корзина); purge — OWNER.
- **2026-11-17** — Уникальность активных `Page.path` — partial index `Page_path_active_key` (`WHERE "deletedAt" IS NULL`). Prisma его не моделирует: в новой миграции, если появится `DROP INDEX "Page_path_active_key"`, **удалить эту строку** и оставить индекс.
- **2026-11-17** — CMS-3: публичный сайт — лёгкий Node `site.cjs` в том же образе (не второй Next). Тестовый хост `site-test.vaybik.ru`; cutover через `SITE_PROD_PRIORITY` (1=off, 50=on). Контент только из `PageRevision`; DRAFT с `publishedRevisionId` остаётся публичным. Кеш инвалидируется `site.contentVersion` (опрос 5 с). vaybik-main не останавливаем.
- **2026-11-17** — Cutover ON: `SITE_PROD_PRIORITY=50`, `SITE_PUBLIC_ORIGIN=https://vaybik.ru`. Тексты сайта — только через админку; HTML в leadweb на тексты больше не влияет (css/js/img/kp — по-прежнему). Откат: `scripts/site-cutover.sh off` или `docker compose stop site`.
- **2026-11-17** — Cutover OFF (~17:02): снова nginx на vaybik.ru; CMS на site-test.
- **2026-11-17** — Cutover ON снова: `SITE_PROD_PRIORITY=50`, origin `https://vaybik.ru`; site-test router снят; llms.txt в SEO (`site.llms`); «Открыть на сайте» → vaybik.ru. Откат: `scripts/site-cutover.sh off`.
- **2026-11-17** — CMS-3a: calcMini/calcFull только из шаблонов (снимок sanitize без form); санитайзер сохраняет `viewBox`; на рендере `fixMissingSvgViewBox`; calculator CSS/JS + lc-bar; hero страницы скрывается при calcFull; header без дубля CTA, лат. id подменю, aria-current; mascot через `<picture>`; декоративные svg в карточках/FAQ.
- **2026-11-17** — Источник правды сайта = админка; импортов leadweb нет. `robots.txt`/`llms.txt` только из SEO; статические файлы удалены из leadweb и `vaybik-main/html`.
- **2026-11-17** — Виджет ИИ-консультанта: Setting `site.chatWidget`; экран `/admin/settings/chat-widget`; CSP-RO +`chat.vaybik.ru`. На проде: enabled, publicId `xA6FHnneH5CW`, **paths `[]` = весь сайт** (сначала был только `/`).
- **2026-11-18** — Клиенты хаба ≠ Partner. Хаб — реестр (`Client` / `ClientService`); чат хранит рабочие данные по `hubClientId`. Контракт HMAC + SSO — в плане. Dev хаба → `chat-test.vaybik.ru`, прод → `chat.vaybik.ru`. Пауза клиента: upsert во все продукты (`archived→off`); при сбое чата — пометка «не синхронизировано», статус хаба не откатываем. Env: `CHAT_BASE_URL`, `HUB_CHAT_API_SECRET`, `HUB_CHAT_SSO_SECRET` (без запасных значений).
- **2026-11-18** — Ф-B каркас: `SsoJti` (только jti), `POST /api/clients/[id]/impersonate` после reauth → **200 `{ redirectUrl }`** (не 302: fetch+manual = opaqueredirect); AuditLog `client.impersonate`; cookie `vaybik_session` не трогаем.
- **2026-11-18** — Срок ClientService: `activeFrom`/`activeUntil` (дата MSK), `paymentNote`. Upsert в чат: `status ACTIVE|PAUSED|EXPIRED|OFF` + даты. Удаление клиента: бэкап хаба → `DELETE /api/hub/clients` → только потом cascade в хабе; иначе `deleteIncomplete`.
- **2026-11-19** — Шаблон контракта подключения сервиса к клиенту хаба: `docs/services/CONTRACT.md` (референс — чат; для lead/Профи и др.). Расхождения с кодом — в §8 файла.
- **2026-11-19** — §8 п.1 закрыт в чате: `hubStatus` + EXPIRED→заглушка (деплой чата после «задеплой»).
- **2026-11-19** — Этап 2 минимум: роль `CLIENT`, `ClientMember`/`ClientInvite` (72 ч), блок «Доступ клиента», `/my-services` + SSO `mode=client`. Кабинет-аналитика не берём. Правки чата (скрыть Group Privacy, оставить /link) — `docs/plans/2026-11-19-client-access-chat-notes.md`. Прод хаба с CLIENT: **`e9efeb2`**.
- **2026-11-19** — Почта клиентам: SMTP Яндекса с **`bilariuss@yandex.ru`** (без Яндекс 360 / без правок DNS). Env: `MAIL_FROM`, `SMTP_*`. Без `SMTP_PASS` — письма выкл., ссылку копируем руками. Письма: invite / −7 / −1 / expired утром `activeUntil+1` (как CONTRACT). Cron worker `0 9 * * *` MSK. Прод: **`edc0b17`**.
- **2026-11-19** — SSO студии: `GET /admin/sso/chat?next=` (OWNER/ADMIN, без reauth) → chat `/sso?token&next`; «Настроить» через SSO; логин уважает `?next=`. Прод: **`222db91`**.
- **2026-11-19** — Справка студии в хабе: кнопка «Справка» у продукта Чат → модалка; server-to-server `GET /api/hub/help` + кэш 5 мин; MD→HTML; только OWNER/ADMIN. Прод с `b391513` (далее SSO на `222db91`).
- **2026-11-19** — Шаблон сообщения приглашения (`clients.inviteMessage`): переменные `{имя}` `{сайт}` `{ссылка}` `{вход}` `{срок_ссылки}`; UI в Настройках; кнопка «Скопировать сообщение для клиента»; тот же текст в письме-invite. Прод: **`c2ea57e`**.
- **2026-11-20** — Лендинг DEMO→ACTIVE: хаб `POST /admin/api/chat/landing-clients` (CONTRACT §4b); чат вызывает через `hubAdminBaseUrl()` (не сырой `HUB_BASE_URL`). Секрет тот же `HUB_CHAT_API_SECRET`.
- **2026-11-20** — В чат-репо (`/opt/vaybik-chat`) с агента хаба **не писать даже на диск** — только текст промпта для агента чата.
- **2026-11-20** — Главная: `#studio` убран; блок `serviceCards` «Наши сервисы»; виджет studio в коде сохранён. Прод хаб `469599e`, CSS leadweb `29aaee3`.
- **2026-11-21** — `/admin/services`: у чата кнопки через SSO (`/sso/chat?next=`); у «Дизайн Атлас» внешние ссылки; slug `design-atlas`; CLIENT страницу не видит (`services.manage`).
- **2026-11-21** — Внутренний сервис «Лиды Профи/YouDo» (`slug=lead`): SSO студии `GET /admin/sso/leads?next=/manage…`, `aud: "leads"`, env `LEADS_BASE_URL` + `HUB_LEADS_SSO_SECRET` (без запасных значений). Не `isProduct`, без upsert клиентов хаба. CLIENT не видит (нет `services.manage`). Деплой SSO — после «задеплой» и когда на lead есть `/sso`.

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

## 8а. Сайт / CMS (часть 1–3, 2026-11-17)

- Модели: `Page`, `Block`, `NavItem`, `Redirect`, `PageRevision`, `Media*`; SEO через `Page.seoPageId` → `SeoPage`.
- Админка: `/admin/site`, редактор `/admin/site/pages/[id]`, предпросмотр `/admin/site-preview/[id]` (noindex, CSS с `SITE_ASSETS_ORIGIN`).
- **CMS-2.1:** список страниц — soft delete (`deletedAt`), корзина, duplicate/publish/unpublish/bulk, сортировка/пагинация/фильтры в URL. Purge — OWNER. Partial unique `Page_path_active_key`.
- **CMS-3:** сервис `site` (`node site.cjs`, :3100) рендерит из БД; label `vaybik.ru` (priority `SITE_PROD_PRIORITY`). Unpublish сбрасывает `publishedRevisionId`. Виджеты public — доверенные HTML из `src/server/cms/render/widgets/`. Тексты/страницы/robots/llms — только админка; leadweb/`vaybik-main` — css/js/fonts/img/kp.
- Seed (разовый): `npm run cms:seed-site`. Импорт leadweb **не использовать** (история: `cms:import`).

## 8. Следующие шаги

1. Лиды: дописать в env хаба `LEADS_BASE_URL` и `HUB_LEADS_SSO_SECRET`; деплой SSO хаба — после «задеплой», когда `lead.vaybik.ru/sso` уже отвечает.
2. Чат: задеплоить `hubAdminBaseUrl()` в `register-landing-client` (с хаба в чат-репо не писать — только промпт).
3. Этап 2+ аналитика кабинета (позже).
4. Промпт 8 — партнёры (фаза 4) — **отложена** (лиды как продукт для CLIENT ≠ этот внутренний сервис).
5. CMS-2b (позже): + между блоками, библиотека секций, drag-and-drop.
6. Яндекс.Метрика на дашборд (отложено).
7. По желанию: Telegram-бот; 2FA владельцу; noreply@ / SPF-DKIM позже (сейчас личный Яндекс).
