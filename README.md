# LAFLAMME

Интернет-магазин мультибрендовой одежды LAFLAMME.

**Все требования — в [техническом задании](docs/TZ.md).** Код пишется по нему. Если требование меняется, сначала правится ТЗ, потом код.

## Из чего состоит проект

| Часть | Папка | Адрес локально | Что это |
|---|---|---|---|
| Бэкенд и админка магазина | `apps/backend` | http://localhost:9000/app | Medusa v2: товары, заказы, клиенты, оплата, доставка, интеграции |
| Витрина | `apps/storefront` | http://localhost:8000 | Next.js 16: сайт, который видят покупатели |
| Админка контента | `apps/storefront` | http://localhost:8000/cms | Payload CMS: баннеры, главная, страницы, журнал |
| Инфраструктура | `infra/` | — | Docker Compose, настройки серверов |
| Документация | `docs/` | — | ТЗ, инструкции |

## Запуск на своём компьютере

Нужно установить: [Node.js 22](https://nodejs.org) и [Docker Desktop](https://www.docker.com/products/docker-desktop/).

1. Запустить базу данных и Redis:

   ```bash
   docker compose -f infra/docker-compose.dev.yml up -d
   ```

2. Установить зависимости:

   ```bash
   npm install
   ```

3. Создать файлы настроек из шаблонов и заполнить их (подсказки внутри):

   ```bash
   cp apps/backend/.env.template apps/backend/.env
   ```

   ```bash
   cp apps/storefront/.env.template apps/storefront/.env
   ```

4. Создать таблицы и базовые настройки магазина (Россия, рубли, склад, канал продаж):

   ```bash
   cd apps/backend && npx medusa db:migrate
   ```

5. Создать администратора магазина:

   ```bash
   cd apps/backend && npx medusa user -e you@example.com -p 'надёжный-пароль'
   ```

6. Взять ключ витрины (Settings → Publishable API Keys → «Витрина LAFLAMME» в админке Medusa) и вписать его в `apps/storefront/.env` в `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`.

7. Запустить всё:

   ```bash
   npm run dev
   ```

При первом входе в `/cms` Payload предложит создать первого пользователя.

Русский язык в админке Medusa: профиль (внизу слева) → Profile → Edit → Language → Русский.

## Этапы

Текущий этап отмечен в [ТЗ, раздел 12](docs/TZ.md#12-этапы).

- [x] Этап 1. Каркас: Medusa, Next.js, Payload, Россия / RUB / русский язык
- [ ] Этап 2. Каталог и синхронизация с МоимСкладом
- [ ] Этап 3. Витрина и SEO
- [ ] Этап 4. Корзина, оформление, Т-Касса, СДЭК
- [ ] Этап 5. Аккаунт, программа лояльности, уведомления
- [ ] Этап 6. Безопасность и запуск
