# План: клиенты хаба ↔ продукт «Чат» (2026-11-18)

Цель: Алексей подключает клиентов из админки (хаб = реестр; чат = рабочие данные по `hubClientId`).  
Промпт 8 (PARTNER/рефералы) **не трогаем**. Клиент ≠ Partner.

## Модели (Prisma)

- **Service+:** `isProduct` (bool, default false), `publicPagePath?`, `manageUrl?` (шаблон, напр. `https://chat.vaybik.ru/manage/clients/{externalId}`).
- **Client:** `name`, `siteUrl?`, `contact?`, `status` (`active|paused|archived`), `createdAt`.
- **ClientService:** `clientId`, `serviceId`, `status` (`setup|active|paused|off`), `externalId?`, `note?`, `startedAt?`; `@@unique([clientId, serviceId])`. Без полей квот/VPS.
- RBAC: Action `clients.manage` → OWNER + ADMIN.
- AuditLog: create/update/connect + позже `client.impersonate`.

## Контракт хаб ↔ чат (канон, менять только вместе)

0. Правда по клиентам — хаб. `hubClientId = Client.id`. `ClientService.externalId` = Client.id в чате.  
   Env (без запасных значений в коде; без ключей функции выкл.):  
   хаб: `CHAT_BASE_URL`, `HUB_CHAT_API_SECRET`, `HUB_CHAT_SSO_SECRET`;  
   чат: `HUB_BASE_URL`, `HUB_CHAT_API_SECRET`, `HUB_CHAT_SSO_SECRET`.  
   Стенд хаба → `chat-test.vaybik.ru`, прод → `chat.vaybik.ru`.

1. **Upsert клиента:** `POST {CHAT_BASE_URL}/api/hub/clients`  
   body `{ hubClientId, name, status: active|paused|off }`  
   `X-Hub-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`  
   отклонять при `|now−t|>300` или неверной подписи (constant-time). Идемпотентно по `hubClientId`.  
   Ответ `200 { externalId }`. `paused|off` → в чате `Client.isActive=false`.

2. **SSO:** `GET {CHAT_BASE_URL}/sso?token=<b64url(payload)>.<b64url(HMAC(payload))>`  
   payload: `{ iss:"vaybik-hub", aud:"chat", jti, iat, exp:iat+60, mode:"impersonate"|"client", sub, email, hubClientId, impersonatedBy, returnUrl }`.  
   Чат: подпись/aud/exp + одноразовый jti; своя cookie `vaybik_chat_session`; redirect без токена в URL; `returnUrl` только хост `HUB_BASE_URL`.  
   Хаб: cookie `vaybik_session` **не** трогаем / не расширяем на `.vaybik.ru`.

3. Права в чате: `impersonate` — экраны клиента + правка вида/часов; `client` (этап 2) — часы RO.

## Фазы

| Фаза | Что | Приёмка |
|------|-----|---------|
| **Ф0** | Этот план | Вопросы закрыты |
| **Ф-A** | Миграция (+бэкап) → UI Клиенты → connect Chat (п.1) → фильтр продуктов → AuditLog | Создать «Тест» → Подключить Чат → externalId+setup → Настроить → пауза → фильтр |
| **Ф-B** | «Войти как клиент» (п.2), jti в БД, AuditLog `client.impersonate`, reauth | SSO-баннер; повтор ссылки 401; >60 с недействительна; «Вернуться» на карточку |
| **Этап 2** | Role CLIENT, ClientMember, Invite+clientId, кабинет плиток + SSO `mode=client` | **только в плане, код не писать** |

Порядок: сначала **dev/стенд**; прод — только после «задеплой». Секреты в `.env` вписывает Алексей.

### Уточнения 2026-11-18 (ответы)

1. Endpoint чата ещё не готов → хаб с ошибкой «Чат недоступен», «Повторить», ручной `externalId`.
2. Смена статуса клиента → upsert во все подключённые продукты; `active→active`, `paused→paused`, `archived→off`. Сбой sync → пометка, статус хаба не откатываем.
3. Dev → `https://chat-test.vaybik.ru`, прод → `https://chat.vaybik.ru`.
4. Сид идемпотентно: `isProduct=true`, `manageUrl` (не перетирать вручную заполненное).
5. Без env — кнопка «Подключить Чат» disabled + подсказка ключей.

## Риски миграций

- Partial unique `Page_path_active_key` (`WHERE "deletedAt" IS NULL`) Prisma не моделирует: если SQL миграции содержит `DROP INDEX "Page_path_active_key"` — **удалить строку**, индекс оставить.
- Новые таблицы/колонки — только ADD; без DROP чужих сущностей.
- Перед migrate: бэкап (`npm run backup:now` / по DEPLOY.md). На проде migrate только внутри `deploy-prod.sh` после «задеплой».
- Без env чат-API/SSO — кнопки disabled + понятная ошибка; полусозданных `ClientService` без `externalId` не оставлять (транзакция / rollback).
