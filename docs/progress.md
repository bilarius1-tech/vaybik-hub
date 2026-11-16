# Прогресс

## Фаза 0 — каркас
- [x] Next.js (App Router, TypeScript strict, ESLint, `src/`, npm)
- [x] `basePath: '/admin'`, `output: 'standalone'`
- [x] Tailwind + токены DESIGN.md (A/B/C + светлая), Manrope
- [x] Prisma: User, Session, Setting, AuditLog + первая миграция
- [x] AppShell (сайдбар 250px, sidefoot, sticky-шапка, тема, Segmented)
- [x] Страницы-заглушки по карте меню TZ §6
- [x] UI-компоненты + витрина `/admin/ui` (только dev)
- [x] Prettier, Vitest, Playwright smoke, worker-заглушка
- [x] GitHub Actions CI (lint, typecheck, test, build + postgres)
- [x] `docs/progress.md` с чек-листом

## Фазы
- [x] Фаза 0 — каркас
- [ ] Фаза 1 — MVP (auth+2FA, layout, дашборд, сервисы, vault, SEO, деплой-пакет)
- [ ] Фаза 2 — Docker
- [ ] Фаза 3 — БД и бэкапы
- [ ] Фаза 4 — партнёры
- [ ] Фаза 5 — публичный хаб (опц.)

## Открытые вопросы
- Имя внешней сети Traefik, entrypoint и certresolver на сервере (уточнить у Алексея).
- Вариант темы A/B/C (по умолчанию A; переключается на `/admin/ui` и через `NEXT_PUBLIC_THEME_VARIANT`).
