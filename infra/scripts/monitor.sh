#!/usr/bin/env bash
# Проверка сайта раз в минуту (cron) и оповещение в Telegram (ТЗ, п. 8.6):
# главная, страница каталога, Medusa, место на диске, срок SSL-сертификата.
# Берёт TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID из infra/.env.backend. Повторно о той же проблеме — не чаще раза в час.
set -uo pipefail
cd "$(dirname "$0")/../.."
. infra/scripts/lib-env.sh; load_env infra/.env; load_env infra/.env.backend
STATE="/tmp/lflame-monitor"; mkdir -p "$STATE"

alert() { # $1 — ключ, $2 — текст
  local f="$STATE/$1"
  if [ -f "$f" ] && [ $(( $(date +%s) - $(stat -c %Y "$f") )) -lt 3600 ]; then return; fi
  touch "$f"
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && curl -fsS -m 10 "${TELEGRAM_API_URL:-https://api.telegram.org}/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    -d chat_id="$TELEGRAM_CHAT_ID" --data-urlencode text="⚠️ Laflamme: $2" >/dev/null || true
}
ok() { rm -f "$STATE/$1"; }

check() { # $1 — ключ, $2 — адрес, $3 — описание
  if curl -fsS -m 15 -o /dev/null "$2"; then ok "$1"; else alert "$1" "$3 не отвечает ($2)"; fi
}
check home "https://$SITE_DOMAIN/" "Главная"
check catalog "https://$SITE_DOMAIN/men" "Каталог"
check medusa "http://127.0.0.1:9000/health" "Medusa"

USED=$(df / --output=pcent | tail -1 | tr -dc 0-9)
if [ "$USED" -ge 85 ]; then alert disk "диск заполнен на ${USED}%"; else ok disk; fi

END=$(echo | openssl s_client -servername "$SITE_DOMAIN" -connect "$SITE_DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$END" ] && [ $(( ($(date -d "$END" +%s) - $(date +%s)) / 86400 )) -lt 14 ]; then alert ssl "SSL-сертификат истекает $END"; else ok ssl; fi

# Бэкап за последние сутки
if ! find infra/backups -name 'lflame-*.gpg' -mmin -1500 | grep -q .; then alert backup "нет бэкапа за последние сутки"; else ok backup; fi
