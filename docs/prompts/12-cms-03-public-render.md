# Промпт CMS-3 — публичный vaybik.ru из БД (часть 3 из 4)

Для агента Cursor в `/opt/vaybik-hub` (Remote-SSH, пользователь `deploy`). Новый чат: «открой день» + этот блок целиком.

Состояние на момент подготовки (2026-11-17, Europe/Moscow): vaybik-hub `61f635b`, на проде CMS-2 (`6cdf520`). В БД 16 страниц, у всех есть publishedRevisionId. /sayt-za-0/, /avtomatizaciya-1c/, /bitrix/ после конвертации в статусе DRAFT (опубликованная версия есть — та, что до конвертации; публикует Алексей). rawHtml осталось 9. Сайт сейчас — nginx-контейнер `vaybik-main` (статика leadweb). Ритуал: «задеплой» = выкат на тестовый хост; отдельное «да» = переключение vaybik.ru.

```
Ты — агент разработки хаба Вайбик (https://vaybik.ru/admin). Я — Алексей, владелец, новичок в терминале: команды запускай сам, объясняй простым русским. Перед удалением данных, restore, force-push, остановкой прода, правкой прод-.env или изменением ролей БД — спроси и дождись «да».

## 0. Открой день

1. По docs/WORKFLOW.md §4: AGENTS.md → WORKFLOW → docs/CONTEXT.md («8а. Сайт / CMS») → последний devlog → docs/progress.md; затем docs/prompts/10-… и 11-…, docs/DEPLOY.md.
2. git pull --ff-only, dev-БД healthy, prisma migrate dev, dev :3000, git push --dry-run, прод /admin/api/health = 200.
3. devlog, «План на день» = разделы этого промпта; коммит `docs: devlog <дата> — открытие дня (CMS-3)`, push. Промпт сохрани новым файлом docs/prompts/12-cms-03-public-render.md, в progress.md — раздел «CMS-3».
4. Параллельно может идти отдельная мелкая задача по списку страниц в /admin/site (действия, пагинация, сортировка, soft-delete). Её не делай и SitePanel-список не переписывай. Если к моменту работы в Page появится deletedAt — публичный сайт обязан такие страницы не отдавать.

## 1. Цель

vaybik.ru рендерится из БД: «Опубликовать» в админке → изменения на сайте за ≤15 с. Черновики никогда не публичны. Вид — как у текущей статики (те же CSS/JS/шрифты, шапка/подвал, виджеты, формы). Переключение без простоя и с мгновенным откатом.

## 2. Архитектура (решение — не Next, а лёгкий Node-сервер в том же образе)

- Почему: у хаба глобальный basePath /admin, второй Next-проект в репо = вторая сборка/конфиг/зависимости. А рендер блоков у нас уже строковый (src/server/cms/render/*), React публичному сайту не нужен. Поэтому: src/site/server.ts (node:http, без фреймворка или с минимальным роутером), бандл esbuild → dist/site.cjs ровно как worker.cjs в Dockerfile (+ COPY в runner). Один образ vaybik-hub-prod, один deploy-prod.sh, общий код через alias @/.
- Новый сервис `site` в docker-compose.yml: image тот же, command ["node","site.cjs"], RUN_MIGRATIONS=0 (миграции никогда не запускает), сети hub + proxy, том uploads:/app/uploads:ro, новый том site-cache:/app/site-cache, label vaybik.managed=true, healthcheck на /healthz, без ports:. Порт 3100.
- БД: на dev — обычный DATABASE_URL. На проде предложи роль только для чтения vaybik_site (SELECT на Page, PageRevision, NavItem, Redirect, SeoPage, MediaAsset, Setting; UPDATE только колонок Redirect.hits/lastHitAt) и SITE_DATABASE_URL в прод .env. Сейчас в прод-Postgres одна роль `vaybik` — создание роли = изменение прод-БД: только после моего «да», пароль генерируешь сам, в чат/логи не печатаешь, копию — в Vault. Без «да» — основная роль, отметь риск в отчёте.
- Общий код. Вынеси из src/app/site-preview/[id]/route.ts и src/server/cms/render/document.ts:
  - src/server/cms/public/visibility.ts — правило публичности (§3);
  - src/server/cms/public/load.ts — загрузка снимка + меню + SEO + настройки + медиа одним заходом;
  - src/server/cms/render/document.ts — renderSiteDocument(opts, mode: "public" | "preview"). Предпросмотр в админке использует тот же рендер в режиме preview (плашка, noindex, без JS). Дублей рендера не делать.

## 3. Что считается опубликованным

- Публична страница, если publishedRevisionId != null, status != ARCHIVED (и deletedAt == null, если поле есть). Статус DRAFT ≠ «скрыта»: restore и конвертер ставят DRAFT, но опубликованная версия продолжает жить. Если отдавать только status=PUBLISHED, то /sayt-za-0/, /avtomatizaciya-1c/, /bitrix/ станут 404. Тест на это обязателен.
- Контент берётся ТОЛЬКО из PageRevision.snapshot (blocks). Таблицу Block публичный сервер не читает вообще — тест/grep-проверка.
- SEO (title/description/canonical/robots/og/jsonLd) — из живой SeoPage (как и сейчас в /admin/seo: правка применяется сразу). Меню, редиректы, настройки — тоже сразу при сохранении. В редакторе покажи подсказку «меню и SEO применяются сразу, блоки — после публикации».
- В редакторе страницы: бейдж «Опубликована · есть неопубликованные изменения», кнопка «Снять с публикации» (publishedRevisionId = null, с ConfirmDialog, аудит cms.page.unpublish) и ссылка «Открыть на сайте» (база из env SITE_PUBLIC_ORIGIN: до переключения https://site-test.vaybik.ru, после — https://vaybik.ru).

## 4. Рендер «как сейчас»

Сверяйся с /opt/vaybik-site-src (только чтение). Факты из исходника:
- head: charset, viewport (viewport-fit=cover), title, description, canonical, robots (у страниц "index,follow,max-image-preview:large"), theme-color #07051a, og:type/locale/site_name/title/description/url/image (+ width 1200, height 630, alt), twitter:*, favicon /img/favicon.svg, preload двух woff2 (manrope-cyrillic-400, unbounded-cyrillic-500), /css/fonts.css, /css/site.css?v=13, alternate /llms.txt, JSON-LD (из SeoPage.jsonLd, у всех 16 страниц он есть).
- По шаблону:
  - default и home — site.css + JS main.js?v=2, magic-rings.js?v=1, gradient-blinds.js?v=1, metrika.js;
  - service (body class="svc") — + service-pages.css?v=2;
  - новый шаблон keysy (/keysy-ii/) — + keysy-ii.css?v=6 и keysy-ii.js?v=2;
  - calculator (/kalkulyator/) — body class="lc-page" data-mode="client", без rings/blinds.
  Версии ?v= — константы в src/server/cms/render/assets.ts с переопределением через Setting `site.assets` (parity-скрипт ловит расхождения). Шаблон keysy добавь в zod-enum и проставь /keysy-ii/ (это поле Page.template, не миграция).
- Шапка — точная разметка leadweb: skip-ссылка, logo, nav-item/has-sub с кнопкой nav-caret (svg, aria-controls="sub-…"), aria-current, CTA «Обсудить проект» (hdr-cta), burger. Мобильное меню #menu (menu-acc, menu-hl, menu-ft с Telegram/e-mail из Setting site.contacts). Подвал: описание, колонки из FOOTER, строка ©, ссылка «Калькулятор для команды» (/kp/, nofollow). Сейчас в document.ts шапка/подвал урезаны — доведи до паритета.
- Виджеты (studio, calcMini, calcFull): HTML снимка прошёл санитайзер — без form/input/button и инлайн-скрипта студии, поэтому калькуляторы в нём не работают. Для public: доверенные партиалы из кода (src/server/cms/render/widgets/*.html — разметку возьми из leadweb, включая инлайн-скрипт студии с index.html), снимок — только запасной вариант для preview. Калькуляторы должны считать (их логика в main.js).
- rawHtml (9 блоков) выводится как есть после санитайза. Проверь, что санитайзер не вырезает то, что нужно keysy-ii.js (data-*, dialog, id). Если вырезает — расширь allowlist точечно (с тестом), JS туда не пускать.
- Метрика: как сейчас подключаем /js/metrika.js (ID пустой → ничего не делает). Если в Setting seo.counters.yandexMetrika появится ID — по желанию инлайн-инициализация вместо файла (решение — в отчёт).
- Картинки медиатеки: сейчас resolveMediaSrc в render/blocks.ts строит `/v<ver>/orig` без расширения и берёт версию из данных блока. Такой URL отклоняет assertSafeMediaPath (400), а после «заменить везде» версия устаревает. Исправь: при загрузке страницы собирай mediaId (collectMediaRefs), одним запросом бери MediaAsset (version, variants, alt, width/height) и передавай в рендер резолвер. На выходе — <picture> с webp-srcset (w480/w960/w1600), width/height, alt, loading="lazy" (кроме hero). База URL — параметр рендера: public → /media, preview → /admin/api/public/media (env MEDIA_PUBLIC_BASE больше не глобальный).
- 404: встроенный шаблон по разметке 404.html leadweb + шапка/подвал, статус 404, без canonical.

## 5. Маршрутизация внутри site-сервера

Порядок обработки запроса:
1. /healthz.
2. /media/<id>/v<n>/<file> — с тома uploads (только чтение), та же проверка assertSafeMediaPath, immutable-кеш, заголовки для SVG как в public/media. Старые /admin/api/public/media/... продолжают работать в хабе.
3. /sitemap.xml и /robots.txt.
4. Redirect из БД. EXACT; PREFIX с переносом хвоста; query-строка сохраняется; 301/302; относительный Location (как absolute_redirect off). hits/lastHitAt копятся в памяти и сбрасываются в БД раз в минуту.
5. Нормализация как у nginx:
   - "/путь" без слэша → 301 на "/путь/", если такая страница есть;
   - "/путь/index.html" → 301 на "/путь/";
   - верхний регистр не трогаем.
6. Страница CMS.
7. Всё, что похоже на файл (есть расширение) или не найдено, — прокси на http://vaybik-main:80 внутри сети proxy (нужно для тестового хоста и как страховка для забытых файлов: verification-файлы, /kp/, studio-preview.html). Ответ 404 от nginx заменяй своей 404-страницей только для HTML-путей.

- sitemap.xml: только публичные страницы с SeoPage.inSitemap; формат как у текущего static sitemap (loc, lastmod = publishedAt, priority). Логику вынеси в src/server/seo/sitemap.ts и переиспользуй в /admin/api/public/sitemap.xml.
- robots.txt: Setting `site.robots` (текст), засеять дословно из /opt/vaybik-site-src/robots.txt (там группы AI-ботов + `User-agent: *` / Disallow: /admin/ + Sitemap), редактирование — textarea в /admin/seo. Если Host ≠ vaybik.ru (тестовый хост) — всегда `Disallow: /` и заголовок X-Robots-Tag: noindex на всех ответах.
- Кеш:
  - готовый HTML каждой страницы хранится в памяти и на диске (/app/site-cache) вместе с gzip и br, отдаётся по Accept-Encoding, с ETag;
  - инвалидация — по «версии контента»: Setting `site.contentVersion` (число) повышает одна функция bumpSiteVersion(tx, reason) в src/server/cms/site-version.ts;
  - её вызывают все мутации, влияющие на сайт: publish/unpublish/restore-публикация, nav, redirects, SeoPage CRUD, media replace/update alt, settings contacts/robots/assets, смена template/path;
  - site-сервер опрашивает версию раз в 5 с (дешёвый SELECT) и при изменении сбрасывает кеш (16 страниц — рендер лениво);
  - тест: каждый мутационный роут вызывает bump.
  Webhook с секретом не нужен — меньше секретов и связей. Если сочтёшь нужным мгновенный пинг, это опционально.
- Если БД недоступна — отдаём последний кеш (память → диск), в логах предупреждение. /healthz: 200, если есть БД или непустой кеш; 503, только если нет ни того, ни другого (тогда Traefik сам уведёт трафик на vaybik-main, см. §6).
- Заголовки как в nginx.conf сейчас:
  - X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, X-Frame-Options SAMEORIGIN;
  - HTML — Cache-Control no-cache, медиа — immutable;
  - маркер X-Vaybik-Site: cms (чтобы видеть, кто ответил).
  CSP сначала в режиме Content-Security-Policy-Report-Only: self + mc.yandex.ru/mc.yandex.com/yastatic.net (метрика с вебвизором), t.me — только ссылки; 'unsafe-inline' для JSON-LD и студии. По итогам — предложение строгого CSP в отчёте. /kp/ (Google Apps Script) обслуживает nginx — CSP site-сервера его не касается.

## 6. Traefik и переключение (что увидено на сервере 17.11, только чтение)

Роутеры сейчас: vaybik-admin(-http) Host(vaybik.ru)&&PathPrefix(/admin) priority 100; vaybik-main (websecure) и vaybik-http (web → to-https) Host(vaybik.ru) priority 17 (по длине правила); vaybik-www(-http) priority 21 с middleware vaybik-to-apex — оно определено в labels КОНТЕЙНЕРА vaybik-main; region*, в том числе region-import-ip = PathPrefix(/r98-import) БЕЗ Host на entrypoint web, priority 20; chat-test 27; whoami-ip 1. Wildcard DNS *.vaybik.ru → VPS работает (site-test.vaybik.ru резолвится), сертификаты — LE HTTP-challenge. Список роутеров можно смотреть только на чтение: `curl -s http://127.0.0.1:8080/api/http/routers` на сервере.

Решения:
- vaybik-main НЕ останавливаем никогда. На нём живут www→apex, http→https для vaybik.ru и статика (css/js/fonts/img/kp/llms.txt). Он же — запасной вариант: если site упал или нездоров, Traefik автоматически вернётся к нему (priority 17). Labels vaybik-main и его compose не трогаем.
- Labels только у нового сервиса site:
  - vaybik-site-test: Host(`site-test.vaybik.ru`), websecure, le, + http-роутер с to-https@docker (для этого хоста можно);
  - vaybik-site: websecure, le, rule `Host(\`vaybik.ru\`) && !PathPrefix(\`/admin\`) && !PathPrefix(\`/css/\`) && !PathPrefix(\`/js/\`) && !PathPrefix(\`/fonts/\`) && !PathPrefix(\`/img/\`) && !PathPrefix(\`/kp/\`) && !Path(\`/studio-preview.html\`) && !Path(\`/llms.txt\`)`, priority=${SITE_PROD_PRIORITY:-1}. При 1 роутер проигрывает vaybik-main (17), то есть выключен; при 50 включён (ниже /admin = 100).
  - HTTP-роутер для vaybik.ru у site НЕ создавать: это делает vaybik-http, и так не перехватим чужой region-import-ip.
- scripts/site-cutover.sh:
  - `on` — проверяет, что свежий (≤24 ч) parity-отчёт без FAIL; дописывает в прод .env SITE_PROD_PRIORITY=50 и SITE_PUBLIC_ORIGIN=https://vaybik.ru (только эти ключи, остальное не трогать и не печатать); `docker compose up -d site`; проверяет `curl -sI https://vaybik.ru/ | grep x-vaybik-site`, все URL sitemap = 200, /admin/api/health = 200, /css/site.css отдаёт nginx;
  - `off` — SITE_PROD_PRIORITY=1 + up -d site;
  - `status`.
  Экстренный откат за секунды: `docker compose stop site` (Traefik сразу вернёт nginx). Все три команды напечатай в отчёте и в DEPLOY.md.
- deploy-prod.sh: добавить site в `up -d`, ожидание healthy и команду отката (сейчас там `app worker`). Пока site пересоздаётся, трафик временно уходит на nginx — простоя нет.

## 7. Parity-проверка (scripts/site-parity.ts)

Сравнивает https://vaybik.ru (статика, до переключения) и https://site-test.vaybik.ru по: всем URL из sitemap, 6 редиректам, /uslugi без слэша, /uslugi/index.html, несуществующему URL, /sitemap.xml, /robots.txt (с поправкой на тестовый хост).
Для каждой страницы:
- статус;
- title, description, canonical, robots, og:*, JSON-LD (равенство после нормализации);
- h1;
- видимый текст main — похожесть ≥ 0,97 по словам, расхождения выводить diff-кусками;
- набор внутренних ссылок шапки, main и подвала;
- все css/js/img из страницы отдают 200;
- body class и наличие нужных скриптов.
Итог — таблица OK / WARN / FAIL в /tmp/site-parity-<дата>.md и .json. Ожидаемые расхождения (например, у 3 DRAFT-страниц на сайте старая опубликованная версия — так и должно быть) помечай WARN с пояснением. Lighthouse (performance, SEO, a11y) по 3 страницам на обоих хостах — если на сервере есть chromium; нет — так и напиши.

## 8. Ещё

- Реестр хаба: сервис «Сайт vaybik.ru (CMS)» в scripts/seed-services.ts — containerNames [vaybik-hub-prod-site-1], healthUrl https://site-test.vaybik.ru/healthz (после переключения — https://vaybik.ru/healthz), keyword "ok".
- Бэкапы не меняются: БД и uploads уже покрыты; site-cache не бэкапим.
- Важное для Игоря (запиши в CONTEXT и в отчёт): после переключения правки HTML в репо leadweb на сайт больше не попадают (только CSS/JS/картинки/kp через deploy-site.sh). Тексты — только через админку. Статичный HTML в vaybik-main постепенно устаревает (он нужен только как аварийный запасной вариант). Предложение на потом: экспорт опубликованных страниц из CMS в статику для этой страховки.
- Место: на / свободно ~14 ГБ (82%), RAM ~3 ГБ доступно. Новый контейнер должен укладываться в ~200 МБ: поставь mem_limit/NODE_OPTIONS и проверь docker stats. Старые образы prev-* не удаляй без меня.

## 9. Тесты и проверки

- vitest:
  - visibility (DRAFT с publishedRevisionId — публична, ARCHIVED — нет, без ревизии — нет);
  - сервер не читает Block;
  - редиректы (exact, prefix + хвост, query, петли, относительный Location);
  - нормализация слэша и index.html;
  - sitemap/robots (тестовый хост → Disallow: /);
  - head-рендер (полный набор мета);
  - резолвер медиа (picture/srcset, нет ассета → без картинки и warn);
  - кеш при недоступной БД;
  - bumpSiteVersion вызывается всеми мутациями.
- e2e (e2e/site-public.spec.ts, база SITE_BASE_URL): правка блока без публикации не видна; после «Опубликовать» видна ≤15 с; «Снять с публикации» → 404; меню меняется сразу; редирект из админки работает.
- npm run lint && typecheck && test && build && test:e2e; локально: `node dist/site.cjs` на dev-БД + parity против dev-сервера по желанию.

## 10. Деплой — два шага

A. «задеплой» (тестовый хост):
1. deploy-prod.sh --dry-run.
2. Бэкап прод-БД: в /opt/apps/vaybik-hub `docker compose exec worker npx tsx scripts/backup-now.ts`, файлы в /var/backups/vaybik/admin/.
3. Новые ключи в прод .env (только добавить): SITE_PUBLIC_ORIGIN=https://site-test.vaybik.ru, SITE_PROD_PRIORITY=1, при «да» на роль — SITE_DATABASE_URL.
4. deploy-prod.sh, откат — в devlog.
5. Засеять site.robots и site.assets, проставить template=keysy для /keysy-ii/ — скриптом с --dry-run.
6. Проверить https://site-test.vaybik.ru, прогнать site-parity.ts, отчёт мне.
Публичный vaybik.ru на этом шаге не меняется (проверь: X-Vaybik-Site нет).

B. Моё «да» на переключение → scripts/site-cutover.sh on → проверки → в devlog время переключения (МСК) и команды отката. Через 10 минут — ещё раз проверка, просмотр логов site и Traefik access-лога на 5xx.

## 11. Нельзя

- region (/opt/apps/region, его роутеры, в том числе region-import-ip) — не трогать и не читать конфиги.
- /opt/proxy, статический конфиг Traefik, acme.json, labels и compose vaybik-main, VPN, sshd, firewall/ufw — только чтение там, где сказано выше. Менять можно labels только нового сервиса site.
- /opt/vaybik-site-src и /opt/apps/vaybik-main — только чтение, deploy-site.sh не запускать.
- Прод .env: только добавить перечисленные ключи; секреты не печатать. Роль БД — только с «да». Миграции (если понадобятся) — только аддитивные.
- Без git push --force; Conventional Commits по-русски.

## 12. Отчёт мне

1. Коммиты (SHA — что).
2. Архитектура: как устроен site-сервис, сколько памяти, роль БД (создана или нет).
3. Правило публичности и что видно в админке (бейдж, снять с публикации, ссылка на сайт).
4. Кеш и инвалидация: какие мутации повышают версию, за сколько секунд правка доходит до сайта.
5. Маршрутизация: labels site, приоритеты, что обслуживает nginx; вывод `/api/http/routers` по vaybik* до и после.
6. Parity-таблица (OK/WARN/FAIL по каждому URL) и Lighthouse.
7. Тесты: lint, typecheck, test, build, e2e.
8. Команды on/off/экстренного отката.
9. Открытые вопросы (CSP строгий, метрика, экспорт статики-страховки, что для части 4).
```
