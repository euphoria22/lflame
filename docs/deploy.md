# Запуск сайта (production)

Всё описано кодом в `infra/`: новый сервер поднимается по этой инструкции примерно за час.
Что где:

| Файл | Что это |
|---|---|
| `infra/docker-compose.prod.yml` | все сервисы: база, Redis, Medusa, CMS, витрина, Caddy |
| `infra/docker/Dockerfile` | сборка Medusa / CMS / витрины |
| `infra/caddy/Caddyfile` | HTTPS, заголовки безопасности, админки только с ваших IP |
| `infra/scripts/server-setup.sh` | первичная защита сервера |
| `infra/scripts/deploy.sh` | выкладка: бэкап → сборка → запуск |
| `infra/scripts/backup.sh`, `restore.sh` | бэкапы и восстановление |
| `infra/scripts/monitor.sh` | проверка сайта раз в минуту, оповещения в Telegram |

## 1. Что купить и подготовить

1. **Сервер (VPS) в РФ**: Ubuntu 24.04, **4 ядра, 8 ГБ памяти, 80 ГБ диска** — Timeweb Cloud, Selectel, Yandex Cloud
   (≈ 2–4 тыс. ₽/мес). Меньше 8 ГБ — сборка витрины будет падать.
2. **Хранилище S3 для фото товаров** — Yandex Object Storage или Selectel (публичный бакет, ≈ 100–300 ₽/мес).
3. **Хранилище для бэкапов у другого провайдера** (ТЗ, п. 8.5): если сервер в Timeweb — бэкапы в Yandex Object Storage, и наоборот.
4. **Домен** laflamme.ru: в DNS у регистратора — A-записи на IP сервера для
   `laflamme.ru`, `www.laflamme.ru`, `admin.laflamme.ru`, `cms.laflamme.ru`.
5. Ключи: боевой терминал Т-Банка, СДЭК (ЛК → Интеграция), SMTP почты, Telegram-бот, токен МойСклада, номер счётчика Метрики.
6. SSH-ключ на вашем компьютере (Windows: `ssh-keygen` в PowerShell) — его открытую часть (`.pub`) провайдер просит при создании сервера.

## 2. Настройка сервера (один раз)

```bash
ssh root@IP_СЕРВЕРА
curl -fsSL https://raw.githubusercontent.com/euphoria22/lflame/main/infra/scripts/server-setup.sh -o setup.sh
SSH_PORT=2222 bash setup.sh
```
После этого вход только так:
`ssh -p 2222 deploy@IP_СЕРВЕРА` (root и пароли отключены).

Код на сервер:
```bash
git clone https://github.com/euphoria22/lflame.git ~/lflame
```

## 3. Настройки

```bash
cd ~/lflame
SITE_DOMAIN=laflamme.ru ADMIN_ALLOW_IPS="ваш.ip" bash infra/scripts/init-env.sh   # пароли и секреты создаются сами
nano infra/.env.backend    # ключи интеграций
```

## 4. Первый запуск

```bash
bash infra/scripts/deploy.sh
```
Первый раз витрина соберётся без ключа витрины. Дальше:
1. Создать администратора: `docker compose -f infra/docker-compose.prod.yml --env-file infra/.env exec backend npx medusa user -e ваша@почта -p ПАРОЛЬ`
   (пароль от 14 символов).
2. Начальная настройка магазина (регион Россия, склад, самовывоз, ключ витрины) выполняется сама при первом запуске
   (`src/migration-scripts`). Способы доставки и оплаты:
   `... exec backend npx medusa exec ./src/scripts/setup-delivery.js` и `... exec backend npx medusa exec ./src/scripts/setup-payments.js`.
3. Ключ витрины deploy.sh берёт из базы и записывает в infra/.env сам.
4. Синхронизация с МойСкладом: админка → «МойСклад» → «Синхронизировать сейчас» (фото уйдут в S3).
5. Пользователь CMS: `... exec cms npm run create-user -w @lflame/cms -- почта пароль`.
   Вход в CMS: https://cms.laflamme.ru/cms (не /admin).
6. Ещё раз `bash infra/scripts/deploy.sh` — витрина соберётся с каталогом.

## 5. Бэкапы и мониторинг

```bash
rclone config                 # хранилище бэкапов у другого провайдера, имя например yandex
nano infra/.env               # BACKUP_PASSPHRASE и BACKUP_REMOTE=yandex:lflame-backups
bash infra/scripts/backup.sh  # проверить
crontab -e                    # вставить строки из infra/scripts/crontab.example
```
**Пароль бэкапов сохраните ещё и вне сервера** — без него бэкап не расшифровать.
Раз в месяц — тестовое восстановление на отдельном сервере: `bash infra/scripts/restore.sh файл` (ТЗ, п. 8.5).

## 6. Включить индексацию

Когда сайт проверен: `INDEXING=on` в infra/.env → `bash infra/scripts/deploy.sh`. Затем Вебмастер, Search Console, sitemap.

## 7. Обновления

Вручную на сервере: `bash infra/scripts/deploy.sh` (бэкап → сборка → запуск, 5–10 минут).
Или с GitHub: Actions → Deploy → Run workflow (секреты SSH_HOST, SSH_PORT, SSH_USER, SSH_KEY; для автовыкладки после
каждого успешного CI — переменная AUTO_DEPLOY=true).

## Безопасность — что уже сделано (ТЗ, п. 8)

- наружу открыты только 80/443 и SSH на своём порту; SSH только по ключу, без root; fail2ban; автообновления;
- база, Redis, Medusa и CMS не видны из интернета;
- админки (admin., cms.) — только с IP из `ADMIN_ALLOW_IPS`; вебхуки и фото — открыты;
- HTTPS с автопродлением, HSTS, CSP и другие заголовки;
- все сервисы в Docker не от root; миграции автоматически; бэкап перед каждой выкладкой;
- бэкапы каждые 6 часов, шифрование, хранение 30 дней у другого провайдера;
- мониторинг каждую минуту: сайт, Medusa, диск, SSL, свежесть бэкапа — оповещения в Telegram;
- CI: линтер, типы, тесты, `npm audit`; Dependabot — обновления зависимостей.

## Журнал тестовых восстановлений

| Дата | Бэкап | Результат | Кто |
|---|---|---|---|
