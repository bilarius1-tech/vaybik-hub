# Контракт: подключение сервиса к клиенту хаба

> **Шаблон** для следующих продуктов (чат — референс; далее lead.vaybik.ru, Профи и др.).  
> Источник правды по смыслу — этот файл. Менять контракт только вместе (хаб + сервис).  
> Референс реализации: продукт **Чат** (`slug=chat`). Где код расходится с шаблоном — §8.

Дата фиксации: **2026-11-19**. Предшественник: план `docs/plans/2026-11-18-services-clients-access.md`.

---

## 1. Источник правды

| Что | Кто владеет | Сервис |
| --- | --- | --- |
| Клиент (`Client.id` = `hubClientId`) | **Хаб** | хранит копию по `hubClientId`, рабочие данные |
| Срок `activeFrom` / `activeUntil` (календарные даты **MSK**) | **Хаб** (`ClientService`) | принимает и исполняет |
| Операционный статус сервиса → контрактный `ACTIVE\|PAUSED\|EXPIRED\|OFF` | **Хаб** считает и шлёт | маппит в локальное «вкл/выкл» |
| `paymentNote` (свободный текст оплаты) | **Хаб** | хранит как справочное поле |
| Рабочие сущности (диалоги, лиды, виджет, …) | — | **сервис** |

- `hubClientId` = `Client.id` в хабе.
- `ClientService.externalId` = id клиента **в сервисе** (для чата — `Client.id` чата).
- Сервис **не** меняет срок и статус «от себя» назад в хаб; только исполняет upsert/delete.

---

## 2. Upsert клиента

```
POST {SERVICE_BASE_URL}/api/hub/clients
Content-Type: application/json
X-Hub-Signature: t=<unix>,v1=<hex>
```

### Тело

```json
{
  "hubClientId": "<Client.id хаба>",
  "name": "<название>",
  "status": "ACTIVE|PAUSED|EXPIRED|OFF",
  "activeFrom": "YYYY-MM-DD|null",
  "activeUntil": "YYYY-MM-DD|null",
  "paymentNote": "<строка>|null"
}
```

- `hubClientId`, `name`, `status` — обязательны.
- Даты и `paymentNote` — опциональны: если поля **нет** в JSON, сервис **не затирает** уже сохранённые значения; явный `null` — очистка (хаб шлёт null только при осознанном сохранении срока).

### Подпись запроса

Как у чата:

- Заголовок: `X-Hub-Signature: t=<unix_sec>,v1=<hex>`
- `v1 = HMAC-SHA256(secret, "<t>.<raw body>")` в hex
- Отклонять при `|now − t| > 300` сек или неверной подписи (**constant-time** compare)
- Секрет: один и тот же `HUB_<PRODUCT>_API_SECRET` на хабе и сервисе (для чата: `HUB_CHAT_API_SECRET`)
- Без секрета в env — интеграция выключена (кнопки disabled / 503), запасных значений в коде нет

Референс:

- хаб: `src/server/chat/signature.ts`, `src/server/chat/hub-client.ts` (`signedJson`, `upsertHubChatClient`)
- чат: `src/server/hub/signature.ts`, `src/app/api/hub/clients/route.ts`

### Идемпотентность

Upsert по `hubClientId` (уникальный ключ на стороне сервиса). Повтор с тем же телом → тот же `externalId`, без дублей.

### Коды ответов (референс чат)

| HTTP | Когда | Тело (чат) |
| --- | --- | --- |
| **200** | ok | `{ "externalId": "<id в сервисе>" }` |
| **400** | нет `hubClientId` / плохой `status` / неверный JSON | `{ "error": { "code", "message" } }` |
| **401** | подпись / skew | `UNAUTHORIZED` |
| **503** | секрет не задан | `HUB_NOT_CONFIGURED` |
| **500** | внутренняя | `INTERNAL` |

Хаб при ошибке сети/HTTP ≠ 2xx: не откатывает свой статус; пишет `lastSyncError` / UI «не синхронизировано». Таймаут fetch хаба: **12 с**.

Маппинг статуса в чате: только `ACTIVE` → `Client.isActive=true`; `PAUSED|EXPIRED|OFF` → `isActive=false`. `paymentNote` обрезается до **2000** символов.

---

## 3. Статус `EXPIRED` и даты

1. **Хаб** вычисляет контрактный статус (`toChatContractStatus`):
   - `paused` (клиент или подключение) → `PAUSED`
   - `archived` / `off` → `OFF`
   - иначе, если `activeUntil` задан и `activeUntil < сегодня (MSK)` → **`EXPIRED`**
   - иначе → `ACTIVE`
2. **Без дат** (`activeFrom`/`activeUntil` = null) и сервис не на паузе → **`ACTIVE`**.
3. День окончания (`activeUntil == сегодня`) ещё **активен**; истечение со следующего календарного дня MSK.
4. `NOT_YET` **не** входит в контракт upsert: это **локальный** режим сервиса, если `activeFrom > сегодня` при ещё «включённом» клиенте (см. §5).

Референс хаб: `src/server/clients/status-map.ts`, `src/server/clients/sync-payload.ts`, `src/server/clients/period.ts` (`todayMskYmd`).

---

## 4. Удаление клиента

```
DELETE {SERVICE_BASE_URL}/api/hub/clients
Content-Type: application/json
X-Hub-Signature: … (та же схема, что у POST)
Body: { "hubClientId": "…" }
```

### Порядок на хабе

1. Подтверждение имени + reauth (UI).
2. **Бэкап БД хаба** (`runAdminBackup`).
3. Вызов `DELETE` во **все** подключённые продукты (`Service.isProduct`).
4. Только после успеха всех — cascade delete `Client` в хабе.
5. При ошибке любого продукта: **не** удалять в хабе; выставить `deleteIncomplete` + `deleteIncompleteError`; бейдж в UI **«удаление не завершено»**.

Референс: `src/server/clients/service.ts` (`deleteClient`), UI `ClientDetail` / `ClientsList` / `DeleteClientControls`.

### Порядок на сервисе (чат)

1. JSON-бэкап среза клиента → `{BACKUPS}/client-deletes/client-…json`.
2. Cascade delete клиента (+ файлы аватаров).
3. Идемпотентно: нет клиента → **200** `{ ok: true, deleted: false, … }`.

Референс: `src/server/client/delete-client.ts`, `DELETE` в `src/app/api/hub/clients/route.ts`.

> Сейчас хаб умеет delete-вызов только для `slug=chat`; остальные продукты → сразу `deleteIncomplete` («удаление в сервисе ещё не реализовано»).

---

## 4a. Справка студии (help)

Опционально для продуктов со студийной справкой в MD (референс — **Чат**). Хаб может забирать тексты server-to-server и показывать у себя; UI `/manage/help` в чате остаётся.

```
GET {SERVICE_BASE_URL}/api/hub/help
X-Hub-Signature: t=<unix>,v1=<hex>
```

### Подпись

Та же схема, что у POST `/api/hub/clients` (§2). Для **GET** тело запроса пустое:  
`v1 = HMAC-SHA256(secret, "<t>.")`  (raw body = `""`).

Секрет: `HUB_CHAT_API_SECRET` (чат). Без сессии браузера.

### Ответ 200

Массив страниц (порядок по `order`):

```json
[
  {
    "slug": "01-new-client",
    "title": "Новый клиент от А до Я",
    "order": 1,
    "updated": "2026-11-19",
    "commit": "0ecc096",
    "markdown": "# …\n(тело без YAML-frontmatter)"
  }
]
```

Источник в чате: `docs/admin-help/*.md`.

### Коды

| HTTP | Когда |
| --- | --- |
| **200** | ok, JSON-массив |
| **401** | нет / неверная подпись / skew |
| **503** | секрет не задан (`HUB_NOT_CONFIGURED`) |

Референс чат: `src/app/api/hub/help/route.ts`, `src/server/admin-help/load.ts` (`listHelpPagesWithMarkdown`).

---

## 5. Поведение сервиса по статусам / сроку

Шаблон ожидаемого UX (исполняет сервис):

| Режим | Смысл | Поведение (чат) |
| --- | --- | --- |
| **ACTIVE** | работает | обычный виджет / продукт |
| **PAUSED** | пауза (хаб `PAUSED`/`OFF` → у чата `isActive=false`) | **молчит** (как будто нет) |
| **NOT_YET** | `activeFrom` в будущем | **молчит** (локальный lifecycle) |
| **EXPIRED** | срок вышел | **заглушка**: текст «обратитесь к Вайбику» + ссылка из env |

Чат — env заглушки:

- `WIDGET_EXPIRED_MESSAGE` (дефолт: «Виджет временно не работает. Чтобы продлить, свяжитесь с Вайбик»)
- `WIDGET_EXPIRED_SUPPORT_URL` (дефолт: `https://t.me/bilarius`)

Референс: `src/server/client/lifecycle.ts`, `src/app/api/widget/[publicId]/config/route.ts`, `src/components/widget/WidgetFrame.tsx`.

`OFF` в контракте upsert отдельным UX не выделяется: для чата это то же «молчит», что и `PAUSED`.

---

## 6. Напоминания о сроке

Шаблон (реализовано в **чате**, не в хабе):

- Когда: за **7** дней, за **1** день и **в день** окончания (`activeUntil`), календарь MSK.
- Куда: группа/каналы клиента (`OperatorChannel.role=CLIENT`) **и** админ-чат:
  -优先тет: `TELEGRAM_ADMIN_CHAT_ID` + студийный бот;
  - иначе каналы с ролью **`STUDIO`**.
- Отметка в БД, чтобы каждое ушло **один раз**: `expiryReminded7dAt` / `1d` / `0d`.
- При смене `activeUntil` в upsert — отметки **сбрасываются**.
- Cron: `EXPIRY_REMINDER_CRON` (по умолчанию `15 9 * * *`, tz Europe/Moscow).

Референс чат: `src/server/client/expiry-reminders.ts`, `src/server/client/lifecycle.ts` (`reminderDue`), `src/worker/index.ts` (job `expiry-reminders`).

Новому сервису: либо свой аналог напоминаний, либо явное решение «делает хаб» — пока канон = **сервис**.

---

## 7. Чек-лист: как подключить новый сервис к хабу

1. **Карточка в «Сервисах»**  
   - запись `Service`: `slug`, `isProduct=true`, `manageUrl` с `{externalId}` (как у чата).  
   - сид по образцу `scripts/seed-chat-product.ts` / `scripts/seed-services.ts` (не затирать ручной `manageUrl`).

2. **Env хаба** (имена по продукту; для чата):  
   - `{PRODUCT}_BASE_URL` → у чата `CHAT_BASE_URL`  
   - `HUB_<PRODUCT>_API_SECRET` → `HUB_CHAT_API_SECRET`  
   - `HUB_<PRODUCT>_SSO_SECRET` → `HUB_CHAT_SSO_SECRET`  
   Без ключей — кнопки подключения/SSO disabled + подсказка missing keys (`src/server/chat/config.ts`).

3. **Env сервиса** (зеркало):  
   - `HUB_BASE_URL`  
   - тот же API/SSO secret  
   - при необходимости: admin chat, expired URL/message, cron.

4. **Эндпоинты сервиса**  
   - `POST /api/hub/clients` — upsert (§2)  
   - `DELETE /api/hub/clients` — удаление (§4)  
   - `GET /api/hub/help` — справка студии (§4a), опционально  
   - `GET /sso?token=…` — вход под клиентом (§ ниже)

5. **Подпись** — та же схема `X-Hub-Signature` (§2); общий секрет; unit-тесты зеркала.

6. **Клиент хаба → sync**  
   - connect: upsert → сохранить `externalId`  
   - смена статуса клиента / срока / paymentNote → upsert  
   - удаление клиента → DELETE (§4)  
   - обобщить ветки `slug === "chat"` в `src/server/clients/service.ts` на реестр адаптеров.

7. **SSO (вход под клиентом)**  
   - хаб: `issueSsoToken` → redirect на `{BASE}/sso?token=`  
   - payload: `iss:"vaybik-hub"`, `aud:"<product>"` (у чата `"chat"`), `jti`, `iat`, `exp=iat+60`, `mode:"impersonate"|"client"`, `sub`, `email`, `hubClientId`, `impersonatedBy`, `returnUrl`  
   - сервис: проверка подписи/aud/exp, одноразовый `jti`, своя session-cookie, redirect **без** token в URL; `returnUrl` только хост хаба  
   - cookie хаба `vaybik_session` **не** расширять на `.vaybik.ru`  
   Референс: хаб `src/server/chat/sso-token.ts`, `src/server/clients/impersonate.ts`; чат `src/app/sso/route.ts`, `src/server/hub/sso.ts`.

8. **UI хаба**  
   - на карточке клиента: подключение, срок, paymentNote, «Настроить» / SSO, бейджи sync / deleteIncomplete.  
   - фильтр продуктов `isProduct`.

9. **Тесты**  
   - подпись, upsert/delete контракт, `toChatContractStatus` / EXPIRED по MSK, SSO token, deleteIncomplete.  
   - Референс: `src/server/chat/hub-client.test.ts`, `status-map.test.ts`, `delete-client.test.ts`, `sync-payload.test.ts`, `sso-token.test.ts`; чат `src/server/hub/signature.test.ts`, `sso.test.ts`.

10. **Стенд / прод**  
    - dev/стенд хаба → стенд сервиса; прод → прод.  
    - Секреты вписывает Алексей; деплой только после «задеплой».

---

## 8. Расхождения с кодом (на 2026-11-19)

Зафиксировано по репозиториям `/opt/vaybik-hub` и `/opt/vaybik-chat` — **не выдумано**. Шаблон выше = целевой контракт; ниже — факт.

1. ~~**EXPIRED → заглушка vs «молчит»**~~ **Исправлено 2026-11-19**  
   Чат хранит `Client.hubStatus` отдельно от `isActive`. Upsert `EXPIRED` → `hubStatus=EXPIRED`, `isActive=false` → lifecycle **`EXPIRED`** → config 200 + заглушка (лаунчер виден). `PAUSED`/`OFF` по-прежнему молчат.  
   Файлы: чат `lifecycle.ts`, `api/hub/clients/route.ts`, `config/route.ts`.

2. **Текст заглушки**  
   Дефолт чата: «Срок работы виджета истёк, свяжитесь с Вайбик» (`WIDGET_EXPIRED_MESSAGE` / `expiredStubMessage()`). Ссылка: `WIDGET_EXPIRED_SUPPORT_URL`.

3. **`NOT_YET` / `OFF`**  
   В теле upsert их нет. `NOT_YET` — только локальный lifecycle чата. `OFF` мапится в то же «молчит», что `PAUSED`.

4. **Удаление других продуктов**  
   Хаб вызывает DELETE только для `slug === "chat"`; любой другой `isProduct` → сразу `deleteIncomplete`.

5. **Connect не-chat**  
   Без ручного `externalId` → `MANUAL_REQUIRED` (`service.ts`); авто-upsert только у чата.

6. **Null-даты в sync**  
   Обычный sync имени/статуса **не** кладёт `activeFrom`/`activeUntil`/`paymentNote`, если они null — чтобы не затирать срок в чате (`buildChatUpsertPayload`, `includePeriodNulls` только при сохранении срока).

7. **Legacy status**  
   Чат ещё принимает lowercase `active|paused|off` (нормализует в UPPERCASE). Хаб шлёт только UPPERCASE.

8. **SSO `returnUrl`**  
   Хаб проверяет/собирает URL относительно **`APP_URL`**; чат проверяет хост **`HUB_BASE_URL`**. Должны совпадать по host; имена env разные.

9. **Ответ DELETE**  
   Чат: `200` с полями `ok`, `deleted`, `clientId?`, `backupFile?`, `removedFiles`. Хаб после успеха смотрит только HTTP ok, тело почти не использует.

10. **Напоминания**  
    Реализованы только в чате; хаб сроков клиенту в Telegram не шлёт.

11. **Аудитория SSO**  
    Зашито `aud: "chat"`. Новому сервису нужен свой `aud` и зеркальная проверка — общего параметра в хабе пока нет.

---

## 9. Карта файлов (референс «Чат»)

### Хаб (`/opt/vaybik-hub`)

| Тема | Путь |
| --- | --- |
| HTTP upsert/delete + подпись | `src/server/chat/hub-client.ts`, `signature.ts`, `config.ts` |
| Статус EXPIRED/MSK | `src/server/clients/status-map.ts` |
| Payload sync | `src/server/clients/sync-payload.ts` |
| Connect / sync / delete | `src/server/clients/service.ts` |
| SSO | `src/server/chat/sso-token.ts`, `src/server/clients/impersonate.ts` |
| UI срок / удаление | `src/components/clients/*` |
| Сид продукта | `scripts/seed-chat-product.ts` |
| План-предшественник | `docs/plans/2026-11-18-services-clients-access.md` |

### Чат (`/opt/vaybik-chat`)

| Тема | Путь |
| --- | --- |
| API | `src/app/api/hub/clients/route.ts` |
| Справка GET `/api/hub/help` | `src/app/api/hub/help/route.ts`, `docs/admin-help/*.md` |
| Подпись | `src/server/hub/signature.ts` |
| Lifecycle / EXPIRED / reminders due | `src/server/client/lifecycle.ts` |
| JSON-бэкап + cascade | `src/server/client/delete-client.ts` |
| Напоминания | `src/server/client/expiry-reminders.ts`, `src/worker/index.ts` |
| SSO | `src/app/sso/route.ts`, `src/server/hub/sso.ts` |
| Заглушка виджета | `src/app/api/widget/[publicId]/config/route.ts`, `WidgetFrame.tsx` |
| Env-пример | `.env.example` |

---

## 10. Связанные документы

- План внедрения чата: `docs/plans/2026-11-18-services-clients-access.md`
- CONTEXT хаба §5 (решения 2026-11-18 про клиентов / срок / delete)
- Чат: `docs/CONTEXT.md` (регистрация = POST + SSO)
)
