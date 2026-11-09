#!/usr/bin/env bash
# Диагностика подключения Medusa к базе (секреты не выводятся). Запуск из папки проекта:
#   bash infra/scripts/diag-db.sh
cd "$(dirname "$0")/../.."
COMPOSE="docker compose -f infra/docker-compose.prod.yml --env-file infra/.env"

echo "== Контейнеры"
$COMPOSE ps --format "table {{.Service}}\t{{.Status}}"

echo "== Адрес базы в настройках Medusa (без пароля)"
$COMPOSE config 2>/dev/null | grep -m1 "DATABASE_URL" | sed 's|//[^@]*@|//***@|'

echo "== Базы в Postgres"
$COMPOSE exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -Atc "select datname from pg_database"'

echo "== Подключение из контейнера Medusa"
$COMPOSE run --rm --no-deps -T --entrypoint node backend -e '
const net = require("net")
const s = net.connect(5432, "postgres")
s.setTimeout(5000)
s.on("connect", () => { console.log("TCP до postgres:5432 — ок"); s.end(); check() })
s.on("timeout", () => { console.log("TCP — таймаут"); process.exit() })
s.on("error", (e) => { console.log("TCP — ошибка:", e.message); process.exit() })
function check() {
  const { Client } = require("/repo/node_modules/pg")
  const url = process.env.DATABASE_URL.replace(/[?&]ssl_mode=[^&]*/, "")
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 8000 })
  c.connect().then(() => c.query("select version()")).then((r) => { console.log("Вход в базу — ок:", r.rows[0].version.slice(0, 20)); process.exit() })
    .catch((e) => { console.log("Вход в базу — ошибка:", e.message); process.exit() })
}'

echo "== Последние ошибки Medusa"
$COMPOSE logs --tail 200 backend 2>/dev/null | grep -i '"error"' | tail -3 | cut -c1-400
