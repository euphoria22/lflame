#!/usr/bin/env bash
# Бэкап баз (Medusa и CMS) и файлов CMS, шифрование и отправка в хранилище другого провайдера (ТЗ, п. 8.5).
#   bash infra/scripts/backup.sh [метка]
# Нужно в infra/.env: BACKUP_PASSPHRASE (пароль шифрования, хранить отдельно!) и BACKUP_REMOTE
# (адрес rclone, например «yandex:lflame-backups»; настроить: rclone config). Хранение — 30 дней.
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . infra/.env; set +a
LABEL="${1:-daily}"
STAMP="$(date +%Y%m%d-%H%M)"
DIR="infra/backups"
FILE="$DIR/lflame-$STAMP-$LABEL.tar.gz.gpg"
mkdir -p "$DIR"
[ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "Нет BACKUP_PASSPHRASE в infra/.env"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
C="docker compose -f infra/docker-compose.prod.yml --env-file infra/.env"
$C exec -T postgres pg_dump -U "$POSTGRES_USER" -Fc lflame_medusa > "$TMP/medusa.dump"
$C exec -T postgres pg_dump -U "$POSTGRES_USER" -Fc lflame_payload > "$TMP/payload.dump"
$C exec -T cms tar -C /repo/apps/cms -cf - media > "$TMP/cms-media.tar" 2>/dev/null || true

tar -C "$TMP" -czf - . | gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" --symmetric --cipher-algo AES256 -o "$FILE"
echo "Бэкап: $FILE ($(du -h "$FILE" | cut -f1))"

if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "$FILE" "$BACKUP_REMOTE/"
  rclone delete --min-age 30d "$BACKUP_REMOTE/" || true
  echo "Отправлен в $BACKUP_REMOTE"
else
  echo "ВНИМАНИЕ: BACKUP_REMOTE не задан — бэкап только на этом сервере"
fi
# Локально храним 7 дней
find "$DIR" -name 'lflame-*.gpg' -mtime +7 -delete
