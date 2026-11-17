# Промпт CMS-1 — хаб: страницы, блоки, меню, редиректы (часть 1 из 4)

Для агента Cursor в `/opt/vaybik-hub` (Remote-SSH, пользователь `deploy`). Новый чат: «открой день» + этот блок целиком.

Состояние на момент подготовки (2026-11-17, Europe/Moscow): vaybik-hub `7f576bf`, leadweb `d52848d` (сайт уже на vaybik.ru). Дорожная карта CMS: **1) страницы/блоки/меню/редиректы + импорт + предпросмотр** ← сейчас; 2) Tiptap + медиагалерея; 3) публичный Next-рендер вместо статики; 4) блог, кейсы, витрина сервисов, заявки + Telegram.

```
Ты — агент разработки хаба Вайбик (https://vaybik.ru/admin). Я — Алексей, владелец, новичок в терминале: команды запускай сам, объясняй простым русским. Перед удалением данных, restore, force-push, остановкой прода или правкой прод-.env — спроси и дождись «да».

## 0. Открой день

1. По docs/WORKFLOW.md §4: AGENTS.md → WORKFLOW → docs/CONTEXT.md → последний devlog → docs/progress.md; затем docs/TZ.md (§7 модели, §8 API, Фаза 5), docs/DESIGN.md, .cursor/rules/20-ui.mdc и 30-backend.mdc, docs/PROMPTS.md (Промпт 9).
2. git pull --ff-only, dev-БД healthy, dev на :3000, git push --dry-run, прод /admin/api/health = 200.
3. devlog на сегодня, «План на день» — пункты этого промпта; коммит `docs: devlog <дата> — открытие дня`, push.
4. Сохрани этот промпт новым файлом docs/prompts/10-cms-01-pages.md (только новый файл, существующие промпты не правь). В docs/progress.md добавь раздел «Фаза 5 / CMS-1» с чекбоксами.
5. Работай сразу, без отдельного «да». На прод — только после моего «задеплой» (§9).

## 1. Цель

В админке появляется раздел «Сайт»: страницы vaybik.ru из блоков, меню шапки/подвала и редиректы — всё в БД, с предпросмотром. Публичный vaybik.ru в этой части остаётся статикой из leadweb и НЕ меняется (рендер из БД — часть 3).

## 2. На что опираться в коде (переиспользуй, не изобретай)

- API-шаблон: src/app/api/seo/pages/route.ts и [id]/route.ts — assertSameOrigin (src/server/http/request.ts), requireCan (src/server/auth/require.ts), zod .parse, jsonOk/jsonError/handleRouteError (src/server/http/response.ts), writeAudit (src/server/auth/audit.ts) с ip/userAgent. Схемы — отдельный файл как src/server/seo/schemas.ts.
- RBAC: src/server/auth/rbac.ts. Добавь Action "content.manage" (OWNER + ADMIN; PARTNER — нет) и тест в rbac.test.ts. rawHtml-блок править может только тот, у кого content.manage (партнёрам — никогда).
- Страница = серверный page.tsx с requireCan + redirect("/") и клиентская панель (как src/app/(app)/seo/page.tsx + src/components/seo/SeoPanel.tsx). Компоненты только из src/components/ui (Card, CardHeader, DataTable, Field/Input/Select/Textarea, Button, Pill, Segmented, ConfirmDialog, EmptyState, Skeleton, Alert, Insight); запросы — src/lib/api-client.ts. Тема A, токены DESIGN.md, без хардкод-цветов, пустые состояния и скелетоны.
- Меню сайдбара: src/lib/nav.ts — один пункт «Сайт» (href "/site", иконка из юникода в стиле остальных). Внимание: там уже есть TS-тип NavItem — он совпадёт по имени с Prisma-моделью NavItem. Отдельным коммитом `refactor(nav): NavItem → SidebarItem` переименуй тип сайдбара (Sidebar.tsx и nav.ts), чтобы не путать.
- SEO уже есть: модель SeoPage (@@unique([host, path]), title/description/canonical/robots/og*/twitterCard/jsonLd/inSitemap/priority/changefreq) и раздел /admin/seo. НЕ дублируй SEO-поля в Page (см. §3).
- Тесты: vitest (src/**/*.test.ts, чистые функции), e2e Playwright (e2e/*.spec.ts). Команды: npm run lint, typecheck, test, build, test:e2e.
- Прод-образ: в runner копируются scripts/ и src/, tsx есть в prod-зависимостях (так работает `docker compose exec worker npx tsx scripts/backup-now.ts`). Новые библиотеки, нужные импортёру на проде, ставь в dependencies, не в devDependencies.

## 3. Модели Prisma (миграция `cms_pages_blocks_nav`, только добавление)

Только новые таблицы/enum и новые nullable-связи; существующие таблицы и колонки не менять и не удалять. Проверь migration.sql глазами: нет DROP/ALTER ... DROP/RENAME по старым таблицам.

- enum PageStatus { DRAFT PUBLISHED ARCHIVED }
- Page: id cuid; path String @unique (формат как на сайте: "/", "/uslugi/landing/" — со слэшем в конце); title String (название в админке и H1 по умолчанию); status PageStatus @default(DRAFT); template String @default("default") (zod-enum: home | default | service | calculator); sortOrder Int; seoPageId String? @unique → SeoPage (onDelete SetNull) — SEO живёт в SeoPage (host "vaybik.ru" + тот же path), в редакторе страницы вкладка «SEO» читает/пишет эту запись через существующую схему seoPageSchema; publishedRevisionId String?; publishedAt DateTime?; importHash String? (sha256 исходного HTML, для идемпотентного импорта); source String @default("manual") (manual | import); createdAt, updatedAt, updatedById String? (без FK, как createdById в Secret/Backup). В SeoPage добавь только обратное поле связи `page Page?` (в SQL таблица seo не меняется).
- Block: id; pageId → Page (onDelete Cascade); type String; sortOrder Int; data Json; isHidden Boolean @default(false); anchor String? (id секции, например "faq"); createdAt, updatedAt; @@index([pageId, sortOrder]). data всегда проходит zod-схему своего типа (§4) на сервере — и при сохранении, и при импорте.
- enum NavMenu { HEADER FOOTER }
- NavItem: id; menu NavMenu; parentId String? → NavItem (вложенность ровно 1 уровень — проверка в zod/сервере); label; url String? или pageId String? → Page (onDelete SetNull; ровно одно из двух); sortOrder; isHidden; isHighlighted Boolean (класс sub-hl, «Калькулятор стоимости»); openInNewTab Boolean; createdAt, updatedAt.
- enum RedirectMatch { EXACT PREFIX }
- Redirect: id; fromPath String @unique; toPath String; code Int @default(301) (только 301|302); match RedirectMatch @default(EXACT) (PREFIX: "/leadweb/" → "/" с переносом хвоста, как rewrite в nginx); isActive Boolean @default(true); hits Int @default(0), lastHitAt DateTime? (считать начнём в части 3); note String?; source (manual | import); createdAt, updatedAt, updatedById.
- PageRevision: id; pageId → Page (Cascade); snapshot Json ({ page, blocks, seo }); note String?; createdById; createdAt; @@index([pageId, createdAt]). Модель простая: блоки в БД = черновик; «Опубликовать» = снимок в PageRevision + Page.status=PUBLISHED + publishedRevisionId. Часть 3 будет рендерить именно опубликованный снимок. Храним последние 20 на страницу (лишние удалять в той же транзакции). «Восстановить» = снимок → блоки черновика (сначала автоснимок текущего черновика с note "до восстановления").

## 4. Типы блоков (из реальной вёрстки leadweb)

Все схемы — src/server/cms/blocks.ts (zod + TS-типы + метка/описание для UI). Общая часть почти у всех: header { kicker?, title?, subtitle? } (это `.sec-h` с `.kicker`, h2, `.muted`) и background: "default" | "alt" (класс `sec alt`). Иконки на сайте — инлайн-SVG (lucide-подобные): храни поле icon как SVG-строку, прогнанную через санитайзер с allowlist SVG-тегов; выбор иконки из набора — позже.

1. hero — секция `.hero` (+ `sub`, `av-hero`, `svc-hero`): variant (home | sub | service), kicker, title, titleAccent (часть в `span.grad`), lead, buttons[{label, href, style: primary|secondary}] (bt-btn / bt-btn2), mascot (ключ пресета картинки vaybik-*, по умолчанию "privet"), feats[{icon?, text}] (`.feats .feat`), rings (JSON data-magic-rings, необязательно, хранить как есть). Хлебные крошки не храним — строятся из path и меню.
2. answer — `.answer` (короткий ответ под hero для AEO) + необязательные facts[{value, label}] (`.facts .fact`).
3. cards — `.grid g2|g3|g4` с `article.card`: header, columns 2|3|4, items[{ num?, icon?, title, text?, price?, checklist?: string[] (`ul.chk`), link?: {label, href} (`.more`/`dir-link`), highlight?: boolean (`hl-card`) }]. Покрывает «Знакомо?», «Услуги и цены», «Почему мы», направления автоматизации, сценарии (`scen`).
4. steps — `ol.steps`: header, items[{title (b), text (span), result (em)}].
5. faq — `.faq details/summary`: header, items[{question, answer (markdown)}]. В части 3 из него же соберём FAQPage JSON-LD.
6. team — `.team .person`: header, people[{name, role, quote, text, photo, photoAlt, width, height}].
7. cases — карточки кейсов портфолио/услуг (класс `case`): header, items[{title, tag?, text, result?, image?, href?}]. Подробные кейсы `/keysy-ii/` (k-do-block) в части 1 идут в rawHtml — модель Case будет в части 4.
8. cta — `.cta` (секции #contact и «Разделы сайта»): title, lead, buttons[], rings?.
9. text — заголовок + markdown (обычный textarea; Tiptap — часть 2).
10. widget — интерактивные вещи со своим JS: key "studio" (анимация студии, index), "calcMini" (`.calc` на главной/услугах), "calcFull" (`lc-` на /kalkulyator/). Данные: key + htmlSnapshot (санитайзенный HTML для предпросмотра). Логику калькуляторов не переносим.
11. rawHtml — запасной вариант для всего, что не распозналось: html (санитайз на сервере при сохранении и при выводе: без script/iframe/on*-атрибутов/javascript:-ссылок, style-атрибуты убрать; классы и data-*-атрибуты оставить, SVG разрешить). В UI — моноширинный textarea + предупреждение. Цель — чтобы импорт уложил в rawHtml как можно меньше.

Санитайзер — одна функция в src/server/cms/sanitize.ts (например sanitize-html или аналог; выбор и allowlist опиши в devlog), тесты на XSS-векторы обязательны.

## 5. Импорт текущего сайта: scripts/cms-import-leadweb.ts

- Аргументы: --src (по умолчанию /opt/vaybik-site-src), --dry-run (ничего не пишет, печатает отчёт), --force (перезаписать страницы, правленные в админке), --only=/path/ (одна страница). npm-скрипт `cms:import`. Исходники только читать — ни одного изменения в /opt/vaybik-site-src.
- Страницы: ровно 16 URL из sitemap.xml источника. kontakty/ (это 301), kp/, studio-preview.html, 404.html не импортировать — перечислить в отчёте как пропущенные.
- Разбор: парсер HTML (node-html-parser или cheerio — в dependencies). `<main>` → секции `section` верхнего уровня по порядку → распознавание по классам из §4 → блоки; anchor = id секции. Не распознал или распознал с потерями — весь `section` целиком в rawHtml (не терять контент). Скрипт `<script>` внутри секции студии не переносить (это widget).
- SEO из `<head>`: title, description, canonical, robots, og:title/description/image, twitter:card, JSON-LD → upsert SeoPage(host "vaybik.ru", path) и связь с Page. Если запись SeoPage уже есть, заполнять только пустые поля (без --force не перетирать то, что вводили в /admin/seo).
- Меню из шапки index.html: HEADER = nav-item (Услуги и Автоматизация с подпунктами, Портфолио, О нас, Контакты → /o-nas/#contacts); CTA «Обсудить проект» в шапке — пункт с openInNewTab. FOOTER = колонки подвала («Услуги», «Разделы») как родители с детьми. Ссылки на импортированные страницы — через pageId, остальное (якоря, t.me, /llms.txt) — url.
- Редиректы из nginx.conf источника: /automation.html → /avtomatizaciya-1c/, /bitrix.html → /bitrix/, /kontakty и /kontakty/ → /o-nas/, /leadweb → /, /leadweb/ PREFIX → / (все 301, source import).
- Идемпотентность: upsert по path / fromPath / (menu, parent, label). Повторный запуск без изменений источника = 0 изменений. Если importHash совпал — пропуск; если страницу правили в админке (source manual или есть ревизии после импорта) — пропуск с пометкой, пока нет --force. Импортированные страницы ставятся в PUBLISHED с первой ревизией "импорт из leadweb <sha>".
- Отчёт (stdout + JSON-файл в /tmp): по каждой странице — блоков по типам, сколько секций ушло в rawHtml и какие (path + класс/id секции + причина); итог: страниц, блоков, пунктов меню, редиректов, создано/обновлено/пропущено.
- Тесты: фикстуры — 2–3 урезанные HTML-страницы (скопируй куски в tests-фикстуры репо хаба) → ожидаемые блоки; парсер nginx-редиректов.

## 6. Админка (/admin/site)

- /site — Segmented-вкладки «Страницы · Меню · Редиректы».
- Страницы: DataTable (path, название, шаблон, статус Pill, блоков, изменено dd.MM.yyyy HH:mm МСК, кем), фильтры по статусу и поиск по path/названию, «Создать страницу» (path валидируется: начинается и заканчивается "/", латиница/цифры/дефис, не под /admin/, уникален, не совпадает с fromPath активного редиректа).
- Редактор /site/pages/[id]: слева список блоков (тип, заголовок, скрыт/видим), справа форма выбранного блока по его схеме. Действия: добавить (выбор типа), вверх/вниз (drag — по желанию, если без тяжёлых зависимостей), дублировать, скрыть, удалить (ConfirmDialog). Повторяющиеся элементы (items/buttons/checklist) — простой редактор списка с добавить/удалить/переставить. Вкладки «Блоки · Настройки страницы · SEO · Версии». Кнопки «Сохранить черновик», «Предпросмотр» (новая вкладка), «Опубликовать». Несохранённые изменения — предупреждение при уходе.
- Версии: список ревизий (дата, кто, заметка) + «Восстановить» с ConfirmDialog.
- Меню: два дерева HEADER/FOOTER, 1 уровень вложенности, выбор страницы из списка или ручной URL, порядок вверх/вниз, скрыть.
- Редиректы: таблица + форма. Валидация на сервере (общая функция в src/server/cms/redirects.ts + тесты): from начинается с "/", не под /admin; to — "/..." или https://; from ≠ to; нет дубля from; нет петли и цепочек длиннее 1 (A→B при существующем B→C — предупредить и предложить A→C); PREFIX не перекрывает другой PREFIX; не ведёт на страницу в статусе ARCHIVED (предупреждение).
- API: /api/cms/pages, /api/cms/pages/[id], /api/cms/pages/[id]/blocks (порядок — одним запросом с массивом id), /api/cms/pages/[id]/publish, /api/cms/pages/[id]/revisions, /api/cms/revisions/[id]/restore, /api/cms/nav, /api/cms/redirects(/[id]). Все мутации — assertSameOrigin + requireCan("content.manage") + writeAudit (action вида cms.page.update, cms.block.delete, cms.page.publish, cms.redirect.create; в diff — только ключевые поля, не весь JSON).

## 7. Предпросмотр

- Роут-обработчик src/app/site-preview/[id]/route.ts → https://vaybik.ru/admin/site-preview/<id>?rev=<revId|draft>; requireCan("content.manage"), без сессии 401/редирект на логин.
- Отдаёт полный HTML-документ: тот же каркас (шапка и подвал из NavItem, классы hdr/ftr/sec/w как на сайте), блоки → HTML серверными функциями src/server/cms/render/*.ts (их же переиспользуем в части 3 — пиши их чистыми и тестируемыми). Стили: <link> на /css/fonts.css и /css/site.css (+ service-pages.css / keysy-ii.css по шаблону) с origin из env SITE_ASSETS_ORIGIN (прод — https://vaybik.ru; в dev через localhost эти файлы не доступны — либо тот же origin + расширение CSP для этого роута, либо отдача css из локальной копии; выбери и опиши).
- Не подключать JS сайта (особенно metrika.js — превью не должно считаться визитом). Так как без main.js элементы `.reveal` остаются opacity:0, добавь инлайн-стиль `.reveal{opacity:1;transform:none}`.
- noindex: <meta name="robots" content="noindex,nofollow"> и заголовок X-Robots-Tag. Плашка сверху «Предпросмотр · черновик/версия от …».
- Учти middleware.ts: X-Frame-Options DENY и frame-ancestors 'none' — превью открываем в новой вкладке, не в iframe. CSP для этого роута расширять минимально (только img/style/font от SITE_ASSETS_ORIGIN, если нужно), для остальной админки не трогать.
- Точность «примерно как сайт» достаточна; rawHtml-блоки должны выглядеть как на живом сайте.

## 8. Проверки

npm run lint && npm run typecheck && npm test && npm run build; e2e: новый e2e/site.spec.ts (логин → /site → создать страницу → добавить блок faq → сохранить → предпросмотр 200 с noindex). Импорт на dev-БД: --dry-run, затем реальный, затем повторный (должно быть 0 изменений). Сверка: 16 страниц, путей как в sitemap.xml, меню совпадает с шапкой/подвалом, 6 редиректов. Пройди предпросмотр всех 16 страниц и сравни с живыми глазами (скриншоты не нужны, достаточно списка расхождений).

## 9. Деплой (только после моего «задеплой»)

1. scripts/deploy-prod.sh --dry-run — покажет новую миграцию.
2. Бэкап прод-БД ДО выката: `docker compose exec worker npx tsx scripts/backup-now.ts` в /opt/apps/vaybik-hub, убедиться, что файл появился в /var/backups/vaybik/admin/.
3. scripts/deploy-prod.sh (миграция применится при старте app). Команду отката из вывода — в devlog. Напомню: откат образа миграцию не отменяет — поэтому миграция только аддитивная.
4. Импорт на проде: исходники передать во временную папку worker без изменения /opt/vaybik-site-src и без правки compose, например `tar -C /opt/vaybik-site-src --exclude=.git -cf - . | docker compose exec -T worker sh -c 'rm -rf /tmp/site-src && mkdir -p /tmp/site-src && tar -C /tmp/site-src -xf -'`, затем `npx tsx scripts/cms-import-leadweb.ts --src /tmp/site-src --dry-run`, показать мне отчёт, после «да» — без --dry-run.
5. Проверить: /admin/api/health и /admin/login = 200, /admin/site открывается, предпросмотр главной работает; https://vaybik.ru/ и все страницы сайта по-прежнему отдаются статикой (curl 200, содержимое не изменилось).

## 10. Нельзя

- region (/opt/apps/region): контейнер, compose, файлы — не трогать и не читать.
- Traefik: /opt/proxy, labels, приоритеты роутеров, acme.json; VPN (/etc/amnezia/*, /opt/xray), sshd_config, firewall/ufw.
- Прод .env: существующие секреты не менять и не печатать; новые ключи (SITE_ASSETS_ORIGIN) — только добавлять и сказать мне.
- /opt/apps/vaybik-main (прод сайта) и /opt/vaybik-site-src — только чтение. scripts/deploy-site.sh не запускать.
- Пароли, токены, строки подключения — не в чат, devlog, коммиты.
- Без git push --force и переписывания истории. Push в main по deploy key пользователя deploy, Conventional Commits по-русски, один логический шаг = один коммит.

## 11. «Закрой день» и отчёт

На «закрой день» — по WORKFLOW §5: devlog (Сделано/Решения/Проблемы/Дальше/Риски/Коммиты), docs/progress.md, docs/CONTEXT.md (раздел «Сайт / CMS»: модели, где импортёр, как запускать, что в части 2).

Отчёт мне (по-русски, таблицами где удобно):
1. Коммиты (SHA — что).
2. Имя миграции и подтверждение, что она только добавляет.
3. Модели и ключевые поля; как Page связана с SeoPage.
4. Типы блоков (итоговый список).
5. Импорт: страниц/блоков/пунктов меню/редиректов; блоки по типам; что ушло в rawHtml (страница, секция, причина); что пропущено.
6. Проверки: lint, typecheck, test, build, e2e, повторный импорт = 0 изменений, расхождения предпросмотра с сайтом.
7. Открытые вопросы и что предлагаешь в часть 2 (Tiptap + медиагалерея).
```
