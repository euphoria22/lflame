#!/usr/bin/env bash
# Записать ключ в infra/.env.backend (или infra/.env), не показывая его на экране. Запуск из папки проекта:
#   bash infra/scripts/set-secret.sh S3_SECRET_ACCESS_KEY
#   bash infra/scripts/set-secret.sh YM_ID infra/.env
set -euo pipefail
cd "$(dirname "$0")/../.."
NAME="${1:?Укажите имя, например S3_ACCESS_KEY_ID}"
FILE="${2:-infra/.env.backend}"
[ -f "$FILE" ] || { echo "Нет файла $FILE"; exit 1; }
read -r -s -p "Вставьте значение $NAME (на экране не видно) и нажмите Enter: " VALUE
echo
VALUE="$(printf '%s' "$VALUE" | tr -d '\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
[ -n "$VALUE" ] || { echo "Пусто — ничего не записано"; exit 1; }
TMP="$(mktemp)"
# Заменить строку NAME=… или дописать в конец; значение не попадает в историю команд
V="$VALUE" awk -v n="$NAME" 'BEGIN{done=0; v=ENVIRON["V"]} index($0, n"=")==1 {print n"="v; done=1; next} {print} END{if(!done) print n"="v}' "$FILE" > "$TMP"
cat "$TMP" > "$FILE"; rm -f "$TMP"; chmod 600 "$FILE"
echo "Записано: $NAME (${#VALUE} символов) в $FILE"
