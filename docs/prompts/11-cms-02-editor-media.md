# Промпт CMS-2 — хаб: формы блоков, Tiptap и медиабиблиотека (часть 2 из 4)

Для агента Cursor в `/opt/vaybik-hub` (Remote-SSH, пользователь `deploy`). Новый чат: «открой день» + этот блок целиком.

Состояние на момент подготовки (2026-11-17, Europe/Moscow): vaybik-hub `76c05f6`, на проде CMS-1 (`b5f32f3`, миграция `20261117100545_cms_pages_blocks_nav`). Импорт на проде: 16 страниц, 111 блоков (hero 16, cards 32, cta 15, answer 11, faq 10, steps 9, widget 4, team 2, rawHtml 12), 39 пунктов меню, 6 редиректов. Подход выбран гибридный: **сейчас** удобные формы блоков, Tiptap и медиабиблиотека как в WordPress; **потом (CMS-2b, не в этом промпте)** возможности как в Gutenberg: «+» между блоками с библиотекой секций и шаблонов, drag-and-drop, клик-для-правки прямо в предпросмотре.

```
Ты — агент разработки хаба Вайбик (https://vaybik.ru/admin). Я — Алексей, владелец, новичок в терминале: команды запускай сам, объясняй простым русским. Перед удалением данных, restore, force-push, остановкой прода или правкой прод-.env — спроси и дождись «да».

## 0. Открой день

1. По docs/WORKFLOW.md §4: AGENTS.md → WORKFLOW → docs/CONTEXT.md (раздел «8а. Сайт / CMS») → последний devlog → docs/progress.md; затем docs/DESIGN.md, .cursor/rules/20-ui.mdc и 30-backend.mdc, docs/prompts/10-cms-01-pages.md.
2. git pull --ff-only, dev-БД healthy, prisma migrate dev, dev на :3000, git push --dry-run, прод /admin/api/health = 200.
3. devlog на сегодня, «План на день» — разделы этого промпта; коммит `docs: devlog <дата> — открытие дня (CMS-2)`, push.
4. Сохрани этот промпт новым файлом docs/prompts/11-cms-02-editor-media.md (существующие не правь). В docs/progress.md — раздел «CMS-2» с чекбоксами, в конце пункт «CMS-2b (позже): + между блоками, библиотека секций, drag-and-drop, клик-для-правки в предпросмотре».
5. Работай по порядку §3 → §4 → §5 → §6 → §7, каждый раздел — отдельные коммиты, main всегда рабочий. На прод — только после «задеплой» (§10).

## 1. Цель

Редактор страниц без JSON: у каждого типа блока своя форма, текст правится в Tiptap, картинки берутся из медиабиблиотеки, справа живой предпросмотр. 12 rawHtml-секций по возможности становятся нормальными блоками. Публичный vaybik.ru в этой части остаётся статикой и не меняется.

## 2. Что уже есть (опирайся на это)

- Схемы блоков: src/server/cms/blocks.ts (zod, transform-санитайз icon/rawHtml/widget), список и подписи типов: src/lib/cms-block-meta.ts. Рендер: src/server/cms/render/blocks.ts, document.ts, escape.ts (simpleMarkdown). Санитайзер: src/server/cms/sanitize.ts (sanitize-html, sanitizeCmsHtml и sanitizeSvgIcon) + тесты.
- Редактор: src/components/cms/PageEditor.tsx (717 строк) — сейчас блок правится как JSON в Textarea («Данные (JSON)»). Список страниц, меню и редиректы: src/components/cms/SitePanel.tsx. Страницы: src/app/(app)/site/page.tsx, site/pages/[id]/page.tsx.
- API: src/app/api/cms/pages/[id]/blocks/route.ts (POST/PATCH/DELETE; каждая правка ставит page.source="manual"), publish, revisions, src/app/api/cms/revisions/[id]/restore (restore заново прогоняет parseBlockData — хорошо), src/server/cms/service.ts, src/server/cms/schemas.ts.
- Предпросмотр: src/app/site-preview/[id]/route.ts (+ ?rev=), CSP для него — ветка sitePreview в src/middleware.ts (style/img/font + SITE_ASSETS_ORIGIN). X-Frame-Options DENY и frame-ancestors 'none' там пока для всех ответов.
- Импорт: scripts/cms-import-leadweb.ts, распознавание: src/server/cms/import/recognize.ts (cheerio), фикстуры: src/server/cms/import/fixtures/. Внимание: FAQ и answer импортированы как .text(), то есть форматирование потеряно (в исходнике оно есть у 3 answer-блоков, у FAQ — нет).
- Загрузки: src/server/uploads/store.ts (UPLOADS_DIR, 2 МБ, png/jpg/webp/svg/ico, имя из randomBytes), выдача: src/app/api/public/uploads/[name]/route.ts (immutable-кеш), загрузка: src/app/api/settings/upload/route.ts. В docker-compose.yml том `uploads:/app/uploads` смонтирован и в app, и в worker.
- Бэкап: src/server/backup/run.ts → archiveUploads() пакует весь UPLOADS_DIR через tar, а затем gzip и encryptBuffer целиком в памяти (формат iv‖tag‖data, src/server/backup/crypto.ts). Хранится 14 дней в /var/backups/vaybik/admin/.
- Права: content.manage (OWNER + ADMIN) в src/server/auth/rbac.ts. Аудит: writeAudit. UI-кит: src/components/ui/*. API-клиент: src/lib/api-client.ts.

## 3. Медиабиблиотека

Модели (миграция `cms_media`, только добавление):
- MediaFolder: id, name, parentId? (не глубже 1 уровня), sortOrder, createdAt.
- MediaAsset: id cuid; kind (IMAGE | SVG | GIF); folderId?; tags String[]; originalName; title?; alt?; caption?; mime; ext; size Int; width Int?; height Int?; sha256 String @unique (дедуп: тот же файл → вернуть существующий ассет с пометкой «уже есть»); version Int @default(1) (растёт при замене, входит в URL); variants Json ([{ name: "w480"|"w960"|"w1600"|"orig", w, h, file, size, mime }]); uploadedById String?; createdAt, updatedAt, deletedAt? (корзина).
- MediaUsage: id, mediaId → MediaAsset (onDelete Restrict), pageId → Page (Cascade), blockId? (Cascade), revisionId? (Cascade), field String (путь вида "people.1.photo" или "html"); @@index([mediaId]), @@index([blockId]).

Хранение и выдача:
- Файлы: UPLOADS_DIR/media/<id>/v<version>/<variant>.<ext>. Тот же том `uploads` — значит, медиа автоматически попадают в существующий ежедневный бэкап. Новых томов и правок compose нет.
- URL: /admin/api/public/media/<id>/v<version>/<variant>.<ext> — новый route handler рядом с public/uploads. Префикс /api/public уже публичный в middleware, Traefik не трогаем (роутер /admin priority 100 уже ловит). Кеш: public, max-age=31536000, immutable (version в URL сбрасывает кеш при замене). Проверка имени регуляркой, без path traversal.
- Учти: robots.txt сайта закрывает /admin/, поэтому картинки по этому адресу поисковики не проиндексируют. Для предпросмотра это не важно. В части 3 публичный рендер будет отдавать те же файлы по /media/... с того же тома. Поэтому в данных блоков храним mediaId, а не URL; URL строит одна функция mediaUrl(asset, variant) с базой из env MEDIA_PUBLIC_BASE (по умолчанию /admin/api/public/media). Новую переменную добавь в .env.example.
- Ответы с SVG: заголовки Content-Security-Policy "default-src 'none'; style-src 'unsafe-inline'; sandbox" и X-Content-Type-Options nosniff. Проверь через curl -I, что middleware их не перетирает (securityHeaders сейчас ставит свой CSP на /api/public).

Загрузка (POST /api/cms/media, multipart, по одному файлу на запрос; в UI — очередь с прогрессом):
- Разрешено: jpeg, png, webp, avif (на вход), gif, svg. Тип определяй по содержимому (sharp metadata / сигнатура), а не только по file.type. Лимит 10 МБ на файл. Проверь лимит тела запроса у middleware/proxy в Next 16 (по умолчанию около 10 МБ, иначе тело обрежется) и задай явно в next.config.ts. Лимит пикселей sharp (limitInputPixels), одна обработка за раз.
- sharp (в dependencies): .rotate() по EXIF, затем EXIF/GPS удалить (без withMetadata). Варианты webp 480/960/1600 (без увеличения), плюс оригинал. Для jpeg/png оригинал пересохранить без метаданных.
- GIF: хранить как есть (анимация), сделать только статичный первый кадр webp для превью в библиотеке. SVG: прогнать через отдельный строгий санитайзер sanitizeSvgFile (без script, foreignObject, style-элементов, on*, внешних href; use — только href="#…"), размеры брать из viewBox.
- Аудит: cms.media.upload / update / replace / delete.

Операции:
- Список: GET /api/cms/media?q=&folder=&kind=&page= (поиск по названию, alt, имени файла, тегам).
- Правка alt, title, caption, folder, tags.
- «Заменить файл везде»: POST /api/cms/media/[id]/replace — id тот же, version+1, новые варианты, старая версия удаляется после успешной записи. Если файл по sha256 уже есть в другом ассете — 409 со ссылкой на него.
- «Где используется»: из MediaUsage — страницы, блоки, опубликованные ревизии.
- Удаление: если есть использование — запрет (409) со списком мест. Если нет — в корзину (deletedAt). «Очистить корзину» — только OWNER, через ConfirmDialog, физически стирает файлы.
- Учёт использования: одна функция collectMediaRefs(type, data) в src/server/cms/media/usage.ts. Она находит mediaId в объектах-картинках и data-media-id в HTML-строках. Вызывается в той же транзакции при сохранении, удалении, дублировании блока, публикации (для ревизии) и restore. Скрипт scripts/cms-media-reindex.ts (--dry-run) пересобирает таблицу целиком.

UI:
- Вкладка «Медиа» в /admin/site (рядом со «Страницы · Меню · Редиректы»): сетка или список, drag&drop нескольких файлов, папки слева, фильтр по типу, поиск, боковая панель ассета (превью, размеры, вес, alt/title/caption, где используется, заменить, удалить). Пустые состояния и скелетоны — по DESIGN.md.
- src/components/cms/MediaPicker.tsx — модалка «выбрать / загрузить» с тем же поиском. Возвращает { mediaId, alt }. Используется в формах блоков и в Tiptap.
- По желанию, отдельным коммитом: scripts/cms-media-import-site-img.ts (--src, --dry-run). Регистрирует картинки из /img/ исходника leadweb в папку «Сайт (leadweb)» без переписывания ссылок в блоках — пригодится в части 3.

## 4. Tiptap

- Пакеты @tiptap/react, @tiptap/pm, @tiptap/starter-kit, @tiptap/extension-image (таблица — по желанию). Проверь совместимость с React 19 и Next 16, в useEditor — immediatelyRender: false (SSR).
- Компонент src/components/cms/RichText.tsx с пресетами:
  - full — h2–h4, жирный, курсив, списки, цитата, ссылка, картинка из MediaPicker, hr;
  - basic — абзацы, списки, жирный, курсив, ссылка;
  - inline — жирный, курсив, ссылка, без блоков.
  Панель кнопок в стиле админки. Ссылка: URL, «в новой вкладке», nofollow.
- Формат хранения — санитайзенный HTML-строкой. Почему: рендер (src/server/cms/render) строковый, санитайзер уже есть, Tiptap читает HTML без конвертера, а в части 3 не нужен серверный generateHTML с тем же набором расширений. Tiptap JSON не храним.
- Новый sanitizeRichText(html, preset) в sanitize.ts — узкий allowlist под каждый пресет. Без class и style, кроме разрешённых. href только http/https/mailto/tel или относительный "/…"/"#…". При target=_blank принудительно rel="noopener noreferrer" (+ nofollow, если выбран). У img только src, alt, width, height, loading и data-media-id, а src при сохранении пересобирается из mediaId. Санитайз и в zod-transform при сохранении, и ещё раз в рендере (как у rawHtml). Чистка вставки из Word и Google Docs — transformPastedHTML на клиенте (удалить span, style, class, пустые абзацы), но авторитет — серверный санитайзер.
- Где включаем:
  - text: новое поле html (full) вместо markdown;
  - faq.items[].answerHtml (basic);
  - answer.html (basic);
  - cards.items[].textHtml, cases.items[].textHtml, team.people[].textHtml (inline).
  Старые поля (markdown, answer, text) схема ещё читает, рендер берёт *Html, а при его отсутствии — старое поле. Формы пишут только новые поля.
- Скрипт scripts/cms-richtext-migrate.ts (--dry-run, --only=/path/; идемпотентный):
  - plain/markdown → HTML: simpleMarkdown для markdown, для plain — экранирование и <p>, затем sanitizeRichText;
  - старые ключи удаляются только после успешной записи нового;
  - перед изменением страницы — автоснимок PageRevision с note «до миграции rich text»;
  - повторный запуск — 0 изменений;
  - опция --src: для 3 answer-блоков восстановить ссылки и жирный из исходного HTML, но только если текущий текст блока совпадает с .text() исходника (то есть его не правили).

## 5. Формы блоков (вместо JSON)

- Разнеси PageEditor.tsx: src/components/cms/blocks/<Type>Form.tsx для hero, answer, cards, steps, faq, team, cases, cta, text, widget (и новых типов из §6) + общие поля src/components/cms/fields/: HeaderFields (kicker/title/subtitle), BackgroundSelect, ButtonsRepeater, Repeater (добавить, удалить, вверх/вниз, дублировать, свернуть), ImageField (MediaPicker + превью + alt), IconField (SVG-строка: textarea + живое превью; выбор из набора — позже), RichText.
- Схемы валидации раздели: чистые zod-схемы с русскими сообщениями — в src/lib/cms-block-schemas.ts (общие для клиента и сервера, без sanitize-html). Серверная обёртка в src/server/cms/blocks.ts добавляет санитайз-transform. Сейчас blocks.ts импортирует sanitize-html — на клиент его тянуть нельзя.
- Картинки в схемах: тип mediaRef = { mediaId?: string|null, src?: string|null, alt?: string|null }. Старые строки ("/img/aleksey.webp") принимаются через preprocess как { src }. Рендер выдаёт <picture> с webp-srcset из variants, width/height и alt (alt блока важнее alt ассета). Поля: team.people[].photo, cases.items[].image, hero.image (по желанию, вместо пресета маскота).
- Ошибки — по-русски у поля. Кнопка «Сохранить» неактивна, пока форма невалидна. Режим «JSON (для владельца)» оставь свёрнутым под спойлером, только для OWNER.
- Живой предпросмотр: справа iframe /admin/site-preview/<id>?embed=1 (без плашки), обновление после автосохранения черновика (debounce ~1,5 с) с сохранением прокрутки и якорем к выбранному блоку (#anchor или data-block-id). В middleware для /site-preview поставить X-Frame-Options SAMEORIGIN и frame-ancestors 'self', для остальных путей оставить DENY и 'none'. У iframe sandbox="allow-same-origin" без allow-scripts: JS предпросмотру не нужен, и это страховка от обхода санитайзера на том же origin, что и админка.
- Автосохранение и конфликты: PATCH блока передаёт updatedAt, сервер отвечает 409, если запись новее (Алексей и Игорь могут править одновременно). В UI — «Изменено другим пользователем, обновить». В аудит пиши только явное сохранение и публикацию, автосохранение — не чаще раза в 5 минут на блок, чтобы не засорять журнал.
- Защита от ухода с несохранёнными изменениями: beforeunload + переход внутри приложения.

## 6. rawHtml → блоки

Сейчас в rawHtml: /sayt-za-0/ и /avtomatizaciya/ (class="sec" без маркеров), /avtomatizaciya-1c/ и /bitrix/ (problems, process, safety — вёрстка service-pages.css), /keysy-ii/ (cases, start), /portfolio/ (сетка кейсов), /o-nas/ (смешанная секция). Точный список возьми из отчёта импорта и прямо из Block на dev.

- Новые и расширенные типы (обязательно для /avtomatizaciya-1c/, /bitrix/, /sayt-za-0/):
  - iconList — variant "plist-cards" (ul.plist-cards: иконка + текст) | "safe" (ul.safe: ibox + h3 + p); items [{ icon, title?, textHtml }].
  - steps + variant: "default" (ol.steps) | "av" (steps av-steps с ibox) | "flow5" (ol.flow5: номер, иконка, заголовок, текст, «Ваш результат») | "k-steps" (keysy start). Новые поля с дефолтами, старые данные валидны без изменений.
  - offer — сетка g2 из answer-карточек с kicker, ценой и hl-box (первая секция /sayt-za-0/, «цена» в /avtomatizaciya/): items [{ kicker?, html, price?, highlight? }].
  - text + layout "one" | "two" (сетка g2 «Что входит»).
  - beforeAfter — ba-list (было → стало) на /avtomatizaciya/, если секция действительно там.
  - cases + variant "portfolio" (card case + kicker + more), team + people[].links (контакты на /o-nas/) — если укладывается без потерь.
  - /keysy-ii/ (диалоги k-case/k-do-block) остаётся в rawHtml, модель Case — в части 4.
- Распознавание добавь в src/server/cms/import/recognize.ts, фикстуры — реальные куски этих секций, тесты.
- Конвертация — scripts/cms-convert-rawhtml.ts (--dry-run, --only=/path/):
  - на вход берётся текущий html rawHtml-блока из БД, а не исходник, поэтому ручные правки внутри rawHtml не теряются;
  - проверка «без потерь»: нормализованный текст рендера нового блока должен совпасть с текстом исходного html, а количество ссылок и картинок — тоже. Не совпало — блок не трогать, причину в отчёт;
  - перед изменением страницы — автоснимок PageRevision «до конвертации rawHtml»; anchor и isHidden сохранить;
  - страницы не публиковать автоматически: результат остаётся черновиком, публикую я;
  - отчёт: страница, блок, было → стало или причина пропуска;
  - импортёр: распознаёт новые типы при свежем импорте. Логику пропуска (importHash, source manual) не ослаблять. И важно: в импортёре `--force` сейчас удаляет ВСЕ NavItem (navItem.deleteMany) — сделай так, чтобы меню пересоздавалось только с отдельным флагом --reset-nav.

## 7. Бэкап медиа и место на диске

- Медиа лежат внутри UPLOADS_DIR, поэтому входят в ежедневный бэкап. Но archiveUploads держит весь архив в памяти (readFile + encryptBuffer) и каждый день пишет полную копию, а хранится 14 штук. На VPS свободно около 20 ГБ — при росте медиа это проблема.
- Сделай:
  1. Потоковое шифрование нового формата v2 (заголовок-маркер, iv‖data‖tag в конце). restore и verify понимают и старый, и новый формат, есть тест на оба.
  2. Перед бэкапом — проверка места (как для БД), иначе ошибка и событие backup.failed.
  3. В UI медиатеки — общий объём медиа; при превышении MEDIA_SOFT_LIMIT_MB (по умолчанию 1024) — предупреждение.
  4. Ретенцию не меняй без меня. Если считаешь, что медиа нужен отдельный режим (еженедельно или инкрементально), — предложи в отчёте.

## 8. Тесты и проверки

- vitest:
  - sanitizeRichText по всем пресетам: javascript:/data:-ссылки, on*, style, iframe, svg-в-html, target без rel, img с чужим src;
  - sanitizeSvgFile: script, foreignObject, внешний use href, xlink:href с javascript:. Заодно добавь xlink:href в allowedSchemesAppliedToAttributes в существующем санитайзере;
  - валидация загрузки: подмена MIME, превышение размера и пикселей, gif остаётся анимированным, EXIF удалён;
  - collectMediaRefs: объекты и HTML, удаление запрещено при использовании;
  - mediaRef preprocess для старых строк;
  - миграция rich text и конвертер rawHtml: идемпотентность, проверка «без потерь»;
  - 409 при конфликте updatedAt.
- e2e (новый e2e/site-media.spec.ts): загрузить картинку → вставить в team через MediaPicker → правка FAQ в Tiptap → автосохранение → iframe предпросмотра показывает изменения → удаление используемой картинки запрещено.
- npm run lint && typecheck && test && build && test:e2e. На dev: миграция rich text и конвертация — сначала --dry-run, потом реально, потом повторно (0 изменений). Предпросмотр всех 16 страниц против живого сайта — список расхождений.
- Закрой заодно существующую дыру: src/server/uploads/store.ts сохраняет SVG без санитайза и отдаёт его с того же origin, что и админка. Прогони SVG через sanitizeSvgFile и добавь те же заголовки ответа в public/uploads.

## 9. Документы

На «закрой день» — по WORKFLOW §5: devlog, progress, CONTEXT («8а. Сайт / CMS»: медиа, где лежат файлы, URL, бэкап v2, новые env MEDIA_PUBLIC_BASE и MEDIA_SOFT_LIMIT_MB, скрипты миграции и конвертации, что в CMS-2b). В docs/DEPLOY.md — шаги деплоя CMS-2.

## 10. Деплой (только после моего «задеплой»)

1. scripts/deploy-prod.sh --dry-run — покажет миграцию cms_media.
2. Бэкап прод-БД до выката: в /opt/apps/vaybik-hub `docker compose exec worker npx tsx scripts/backup-now.ts`, убедиться, что файлы появились в /var/backups/vaybik/admin/.
3. Новые env (MEDIA_PUBLIC_BASE, MEDIA_SOFT_LIMIT_MB) — только добавить в прод .env, если дефолты не подходят; существующие ключи не трогать и не печатать; сказать мне.
4. scripts/deploy-prod.sh, команду отката — в devlog (миграцию откат образа не отменяет, поэтому она только аддитивная). Проверить, что sharp работает в прод-образе (загрузка тестовой картинки и удаление из корзины).
5. На проде: `npx tsx scripts/cms-richtext-migrate.ts --dry-run` и `scripts/cms-convert-rawhtml.ts --dry-run` в worker — отчёт мне. Реальный запуск — только после моего «да». Публикацию страниц после конвертации делаю я или ты по моей команде.
6. Проверка: /admin/api/health и /admin/login = 200, /admin/site и «Медиа» открываются, предпросмотр в iframe работает, https://vaybik.ru/ и страницы сайта — по-прежнему статика (curl 200, без изменений). Ночной бэкап после деплоя прошёл (проверить утром или запустить backup-now).

## 11. Нельзя

- region (/opt/apps/region) — не трогать и не читать.
- Traefik: /opt/proxy, labels, приоритеты, acme.json; VPN (/etc/amnezia/*, /opt/xray), sshd_config, firewall/ufw.
- /opt/apps/vaybik-main и /opt/vaybik-site-src — только чтение, deploy-site.sh не запускать. Публичный сайт в этой части не меняется.
- Прод .env: существующие секреты не менять и не печатать. Пароли, токены, строки подключения — не в чат, devlog, коммиты.
- Миграции только аддитивные. Без git push --force. Push в main по deploy key, Conventional Commits по-русски.

## 12. Отчёт мне

1. Коммиты (SHA — что).
2. Миграция(и) и подтверждение, что только добавление.
3. Медиа: модели, где лежат файлы, URL, лимиты, что с SVG/GIF, бэкап v2 (размер архива uploads до и после, объём медиа).
4. Tiptap: пресеты, где включён, формат хранения; итоги миграции rich text (сколько полей, пропуски).
5. Формы: какие типы готовы, что осталось в JSON-режиме.
6. rawHtml: было 12 → стало N; таблица «страница · секция · новый тип или причина остаться в rawHtml».
7. Проверки: lint, typecheck, test, build, e2e, повторные запуски = 0 изменений, расхождения предпросмотра.
8. Открытые вопросы и предложения для CMS-2b и части 3 (публичный /media/, индексация картинок).
```
