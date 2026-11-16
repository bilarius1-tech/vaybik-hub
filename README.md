# vaybik-hub — админка хаба Вайбик

Единая панель управления для **https://vaybik.ru/admin**: дашборд, сервисы на поддоменах (`chat.vaybik.ru`, `lead.vaybik.ru`, …) с мониторингом и управлением через Docker, настройки и SEO Вайбика, зашифрованные доступы, партнёры, базы данных и бэкапы, пользователи с 2FA, журнал и Telegram-уведомления. Стиль — как [km-dashboard](https://ztim2008.github.io/km-dashboard/), акцент Вайбика `#ff8a1f`.

Стек: Next.js (App Router, TypeScript) · PostgreSQL · Prisma · Tailwind · Docker Compose за существующим Traefik · docker-socket-proxy.

## Документы
- [`docs/TZ.md`](docs/TZ.md) — полное ТЗ: модули, модель данных, API, безопасность, фазы и критерии приёмки
- [`docs/DESIGN.md`](docs/DESIGN.md) — дизайн-токены и компоненты (из km-dashboard)
- [`docs/PROMPTS.md`](docs/PROMPTS.md) — готовые промпты для агентов Cursor по фазам
- [`AGENTS.md`](AGENTS.md) и [`.cursor/rules/`](.cursor/rules) — правила для агентов

## Как стартовать в Cursor
1. Клонировать: `git clone https://github.com/bilarius1-tech/vaybik-hub.git`
2. В Cursor: **File → Open Folder…** → папка `vaybik-hub`.
3. Открыть чат агента (`Ctrl+L`, новый чат — `Ctrl+N`), выбрать режим **Agent**.
4. Скопировать **Промпт 1** из [`docs/PROMPTS.md`](docs/PROMPTS.md) и отправить. Агент соберёт каркас (Фаза 0).
5. Проверить результат по критериям из `docs/TZ.md` §11, затем запускать следующий промпт.

## Локальный запуск (Фаза 0 + Auth)
```bash
cp .env.example .env   # POSTGRES_*, DATABASE_URL, SESSION_SECRET, VAULT_MASTER_KEY
docker compose -f docker-compose.dev.yml up -d
npm install && npx prisma migrate dev
npm run seed:owner     # интерактивно: email + пароль (≥ 12)
npm run dev            # http://127.0.0.1:3000/admin (только localhost)
# npm run worker       # заглушка; задачи — дальше в Фазе 1
```
После входа OWNER/ADMIN обязана настройка 2FA (`/admin/setup-2fa`).  
Витрина UI (dev, после входа): http://127.0.0.1:3000/admin/ui

Проверки: `npm run lint && npm run typecheck && npm test` · e2e: `npx playwright install chromium && npm run test:e2e`

## Важно
- Агенты не заходят на сервер и не деплоят — деплой вручную по `docs/DEPLOY.md` (появится в Фазе 1).
- На сервере работает VPN — не трогать `acme.json`, `/etc/amnezia/*`, `/opt/xray/config.json`, `sshd_config`, конфиг Traefik.
- Секреты не коммитить: только `.env.example`.
