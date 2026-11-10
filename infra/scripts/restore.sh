#!/usr/bin/env bash
# Восстановление из бэкапа (ТЗ, п. 8.5 — раз в месяц тестовое восстановление на отдельном сервере).
#   bash infra/scripts/restore.sh infra/backups/lflame-....tar.gz.gpg
# ВНИМАНИЕ: заменяет текущие базы. На рабочем сервере — только если всё сломалось.
set -euo pipefail
cd "$(dirname "$0")/../.."
. infra/scripts/lib-env.sh; load_env infra/.env
FILE="${1:?Укажите файл бэкапа}"
read -r -p "Базы будут заменены данными из $FILE. Продолжить? Напишите ДА: " ok
[ "$ok" = "ДА" ] || exit 1
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
gpg --batch --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" -d "$FILE" | tar -C "$TMP" -xzf -
C="docker compose -f infra/docker-compose.prod.yml --env-file infra/.env"
$C stop backend cms storefront
for db in lflame_medusa:medusa lflame_payload:payload; do
  name="${db%%:*}"; dump="${db##*:}"
  $C exec -T postgres pg_restore -U "$POSTGRES_USER" --clean --if-exists -d "$name" < "$TMP/$dump.dump"
done
[ -s "$TMP/cms-media.tar" ] && $C run --rm -T cms tar -C /repo/apps/cms -xf - < "$TMP/cms-media.tar" || true
$C up -d backend cms storefront
echo "Восстановлено. Запишите дату проверки в docs/deploy.md (журнал восстановлений)."
