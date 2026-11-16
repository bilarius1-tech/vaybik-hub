# Правила для агентов Cursor — vaybik-hub

Проект: админка хаба **Вайбик** по адресу `https://vaybik.ru/admin`. Полное ТЗ — `docs/TZ.md`, дизайн — `docs/DESIGN.md`, промпты по фазам — `docs/PROMPTS.md`.

> **Сначала прочитай:** [`docs/WORKFLOW.md`](docs/WORKFLOW.md) (как работать: режим новичка, ритуал дня, push, деплой, новые сервисы) и [`docs/CONTEXT.md`](docs/CONTEXT.md) (память проекта), затем последний [`docs/devlog/`](docs/devlog/) и `docs/progress.md`. Стартовый промпт сессии — `docs/prompts/00-start-session.md`.

## Язык
- Общение, комментарии к PR, документация, тексты интерфейса — **на русском**.
- Идентификаторы кода, имена файлов, коммиты-префиксы — на английском (`feat:`, `fix:`, `chore:`, `docs:`, `test:`); описание коммита можно по-русски.

## Стек (не менять без согласования)
Next.js (App Router, TypeScript strict) с `basePath: '/admin'`, PostgreSQL 16, Prisma, Tailwind (токены из `docs/DESIGN.md` через CSS-переменные), Zod, Chart.js, pg-boss (worker), dockerode через `tecnativa/docker-socket-proxy`, Vitest, Playwright, Docker Compose. Менеджер пакетов — npm.

## Порядок работы
1. Работать **строго по фазам** из `docs/TZ.md` §11: 0 → 1 → 2 → 3 → 4 → 5. Не начинать следующую фазу, пока не выполнены критерии приёмки текущей.
2. Перед началом фазы — прочитать ТЗ и DESIGN, составить короткий план в `docs/progress.md` (чек-лист), по ходу отмечать выполненное.
3. **Маленькие коммиты**: один логический шаг = один коммит, каждый коммит собирается (`npm run lint && npm run typecheck && npm test`).
4. Миграции Prisma — только через `prisma migrate dev --name ...`, миграции коммитятся.
5. После фазы — обновить `README.md`/`docs/DEPLOY.md`, если поменялся запуск.

## Безопасность (обязательно)
- **Никогда не коммитить секреты.** Только `.env.example` с пустыми/фиктивными значениями. `.env*` в `.gitignore`.
- Пароли — argon2id. Секреты vault — AES-256-GCM (envelope, мастер-ключ из env). Секреты не логировать и не отдавать в списках.
- Проверка ролей — на сервере в каждом обработчике. Все входные данные — Zod.
- Docker — **только** через socket-proxy; никогда не монтировать `/var/run/docker.sock` в контейнер приложения.
- Denylist контейнеров для управления: Traefik, Amnezia, Xray, WireGuard и всё, чего нет в реестре сервисов.

## Сервер
- Агент работает **на сервере** по Remote-SSH как `deploy` в dev-checkout `/opt/vaybik-hub`. Сам пушит в GitHub (deploy key) и сам деплоит прод **только** через `scripts/deploy-prod.sh` после зелёных проверок — см. `docs/WORKFLOW.md` §7.
- Прод-checkout `/opt/apps/vaybik-hub` руками не править; прод-`.env` — только добавлять новые ключи, секреты не печатать.
- **Запрещено** изменять/читать/монтировать: `acme.json`, `/opt/proxy` (конфиг Traefik), `/etc/amnezia/*`, `/opt/xray/config.json`, `/etc/ssh/sshd_config`, VPN (Amnezia, Xray), firewall, чужие проекты в `/opt/apps`.
- Своим контейнерам можно только добавлять Traefik **labels** и подключать их к существующей внешней сети Traefik.
- Не предлагать сторонние `curl … | sudo bash` скрипты; только официальные пакеты/образы.

## Как запускать локально
```bash
cp .env.example .env          # заполнить локальные значения
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL (+ socket-proxy при необходимости)
npm install
npx prisma migrate dev
npm run seed:owner             # создать владельца
npm run dev                    # http://localhost:3000/admin
npm run worker                 # фоновые задачи (health-checks, уведомления, бэкапы)
```
Проверки перед коммитом: `npm run lint && npm run typecheck && npm test`; перед завершением фазы — ещё `npm run build` и `npm run test:e2e`.

## Стиль UI
Повторять вид km-dashboard (см. `docs/DESIGN.md`): сайдбар 250px, карточки радиус 16 с градиентом, KPI 28px/800 с полоской снизу, Manrope, тёмная тема по умолчанию, акцент Вайбика `#ff8a1f`. Без хардкод-цветов — только токены. Демо-данные помечать бейджем «демо».

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
