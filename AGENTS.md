# Лавбрю — сайт + PWA + админка для кофейни (Красногорск)

Единый full-stack проект: сайт-витрина (`/`), PWA-приложение (`/app`), админка (`/admin`).
Эндклиент — кофейня «Лавбрю», ИП Аветисян Е.С. Разработка — Бароша (baroshacode.ru).

## Стек
- Frontend: React 19 + TypeScript + Vite 7 + Tailwind CSS + shadcn/ui + tRPC react-query
- Backend: Hono + tRPC 11 + Drizzle ORM, БД MySQL 8
- Полное описание архитектуры, роутеров и сервисов: см. `info.md`

## Ключевые правила (ОБЯЗАТЕЛЬНО)

1. **package-lock.json не удалять и не пересоздавать.** Если нужно обновить зависимости:
   `npm config set registry https://registry.npmjs.org/ && npm install`
   (в lock-файле раньше было битое зеркало `npm.mirrors.msh.team` — оно сломает сборку `npm ci`)
2. **Не менять без необходимости:** `docker-compose.yml`, `Dockerfile`, `db/schema.ts` (согласовать)
3. **Интеграция Quick Resto** изолирована в `api/quickresto/` через интерфейс `RestoProvider` —
   контракт не ломать. Настройки интеграции (креды, qr_enabled) хранятся в БД, настраиваются
   через админку, в код не вшивать
4. **Секретов в коде нет.** `.env` не коммитить (шаблон — `.env.example`)
5. Тесты/проверка перед коммитом: `npm run check && npm run build`

## Деплой (продакшн-сервер)

- Проект на VPS в `/var/www/lovebrew` (доступ к серверу выдаёт владелец отдельно, не хранить в git)
- Деплой: `git push` → на сервере `git pull && docker compose up -d --build app`
  (restart недостаточно — статика фронта запекается в образ при сборке)
- Сейчас сайт доступен по IP, после переключения домена — https://lovebrew-loft.ru

## Бэкапы сервера

`/var/backups/lovebrew/` — архив проекта + дамп БД (mysqldump --no-tablespaces)

## Не трогать на сервере

- БД MySQL в контейнере `db` (там тестовые данные и настройки Quick Resto/Telegram)
- Не запускать `db:push`/seed поверх существующей БД