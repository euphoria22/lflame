#!/usr/bin/env bash
# Выкладка новой версии на сервер (ТЗ, п. 8.1): бэкап → сборка → запуск. Запуск из папки проекта:
#   bash infra/scripts/deploy.sh
# Порядок важен: витрина при сборке берёт данные у Medusa и CMS, поэтому они поднимаются первыми.
set -euo pipefail
cd "$(dirname "$0")/../.."
COMPOSE="docker compose -f infra/docker-compose.prod.yml --env-file infra/.env"

[ -f infra/.env ] || { echo "Нет infra/.env — скопируйте infra/prod.env.template и заполните"; exit 1; }
[ -f infra/.env.backend ] || { echo "Нет infra/.env.backend — скопируйте infra/backend.env.template и заполните"; exit 1; }

wait_for() { # $1 — адрес, $2 — название, $3 — сервис (для журнала при ошибке)
  echo "   ждём $2 (первый запуск — до 6 минут)…"
  for _ in $(seq 1 180); do curl -fs -o /dev/null "$1" && return 0; sleep 2; done
  echo "Не дождались: $2. Последние строки журнала:"
  $COMPOSE logs --tail 60 "$3"
  exit 1
}

echo "== Обновляем код"
git pull --ff-only

echo "== Бэкап базы перед выкладкой"
if $COMPOSE ps postgres --status running -q | grep -q .; then bash infra/scripts/backup.sh pre-deploy; fi

[ -s infra/certs/russian-trusted-ca.pem ] || bash infra/scripts/ru-ca.sh || echo "ВНИМАНИЕ: нет сертификатов Минцифры — оплата Т-Банка может не работать"

echo "== База, Redis, Medusa"
$COMPOSE build backend
$COMPOSE up -d postgres redis backend
wait_for http://127.0.0.1:9000/health "Medusa" backend

# Ключ витрины (публичный, не секрет) создаётся при первом запуске Medusa — подставляем сами
if ! grep -q '^MEDUSA_PUBLISHABLE_KEY=.' infra/.env; then
  KEY=$($COMPOSE exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d lflame_medusa -Atc "select token from api_key where type = '"'"'publishable'"'"' and revoked_at is null and deleted_at is null order by created_at limit 1"')
  if [ -n "$KEY" ]; then
    sed -i "s|^MEDUSA_PUBLISHABLE_KEY=.*|MEDUSA_PUBLISHABLE_KEY=$KEY|" infra/.env
    echo "   ключ витрины записан в infra/.env"
  else
    echo "Нет ключа витрины в базе — создайте его в админке (Настройки → Publishable API keys)"; exit 1
  fi
fi

echo "== CMS"
$COMPOSE build cms
$COMPOSE up -d cms
wait_for http://127.0.0.1:3001/cms "CMS" cms

echo "== Витрина"
$COMPOSE build --build-arg BUILD_ID="$(date +%s)" storefront
$COMPOSE up -d storefront caddy

docker image prune -f >/dev/null
echo "== Готово: https://$(grep ^SITE_DOMAIN= infra/.env | cut -d= -f2)"
