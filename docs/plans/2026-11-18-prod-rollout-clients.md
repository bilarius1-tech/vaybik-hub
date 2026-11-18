# Выкат Ф-A+Ф-B на прод (подготовка, без запуска)

Статус: **ждём чат** → Алексей вписывает ключи → говорит «задеплой».  
Агент **не** деплоит и **не** правит прод-`.env` значениями секретов.

## Прод-`.env` хаба

Точный путь: **`/opt/apps/vaybik-hub/.env`** (chmod 600, владелец `deploy`).

Сейчас: `APP_ENV=prod` есть; `CHAT_BASE_URL` / `HUB_CHAT_API_SECRET` / `HUB_CHAT_SSO_SECRET` — **ABSENT** (впишет Алексей).

Добавить (значения — только Алексей, агент не печатает):

```env
CHAT_BASE_URL=https://chat.vaybik.ru
HUB_CHAT_API_SECRET=
HUB_CHAT_SSO_SECRET=
```

## Что уедет с origin/main

- Миграции: `clients_chat_product`, `sso_jti` (2 шт.; откат образа их **не** отменяет)
- UI `/admin/clients`, HMAC connect, SSO impersonate (302)
- Сид после выката: `npm run seed:chat-product` → при `APP_ENV=prod`  
  `manageUrl=https://chat.vaybik.ru/manage/clients/{externalId}` (не перетирает уже заполненное)

## Блокер до «задеплой»

1. Чат на проде отдаёт `/api/hub/clients` и `/sso` (отчёт чата).
2. Ключи вписаны в `/opt/apps/vaybik-hub/.env`.
3. В прод-checkout сейчас локальный drift `scripts/deploy-prod.sh` — перед деплоем сбросить  
   (`git checkout -- scripts/deploy-prod.sh`), иначе `deploy-prod.sh` откажется.

## Порядок при «задеплой» (агент)

1. Сбросить локальный drift в `/opt/apps/vaybik-hub` (только отслеживаемые правки deploy-скрипта).
2. Бэкап прод-БД **до** миграции:  
   `cd /opt/apps/vaybik-hub && env -u DOCKER_HOST docker compose exec worker npx tsx scripts/backup-now.ts`  
   (или актуальная команда из DEPLOY.md § бэкапы).
3. `scripts/deploy-prod.sh` (lint/typecheck/test → pull → build → migrate on start → health).
4. `docker compose exec app npx tsx scripts/seed-chat-product.ts` (идемпотентно).
5. Проверка: health 200; `/admin/clients`; фильтр продуктов; connect + «Войти как клиент» на стенде/проде по чек-листу Ф-A/Ф-B.
6. Команду отката из вывода скрипта — в devlog.

Прод-checkout руками не править; Traefik / region / acme / VPN — не трогать.
