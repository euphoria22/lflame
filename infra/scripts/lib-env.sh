# Чтение infra/.env и infra/.env.backend без выполнения как кода: значения с пробелами,
# скобками и спецсимволами (список IP, «Основной склад (…)», «Laflamme <…>») читаются как есть.
# Использование: . infra/scripts/lib-env.sh; load_env infra/.env
load_env() {
  local line key value
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in ''|'#'*) continue ;; esac
    [[ "$line" == *=* ]] || continue
    key="${line%%=*}"; value="${line#*=}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    # Кавычки вокруг значения убираем, как это делает docker compose
    if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
    export "$key=$value"
  done < "$1"
}

# Хранилище бэкапов из переменных — без ручной настройки rclone:
#   S3 (Selectel, Timeweb, Yandex Cloud…) — BACKUP_S3_*;  или SFTP на другой хостинг (Beget) — BACKUP_SFTP_*.
# Ключи вводятся через infra/scripts/set-secret.sh в infra/.env. Удалённый адрес: backup:<бакет>.
setup_backup_remote() {
  if [ -n "${BACKUP_S3_ACCESS_KEY:-}" ] && [ -n "${BACKUP_S3_SECRET_KEY:-}" ] && [ -n "${BACKUP_S3_BUCKET:-}" ]; then
    export RCLONE_CONFIG_BACKUP_TYPE=s3
    export RCLONE_CONFIG_BACKUP_PROVIDER=Other
    export RCLONE_CONFIG_BACKUP_ENDPOINT="${BACKUP_S3_ENDPOINT:?Нет BACKUP_S3_ENDPOINT в infra/.env}"
    export RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY"
    export RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY"
    export RCLONE_CONFIG_BACKUP_REGION="${BACKUP_S3_REGION:-ru-1}"
    export RCLONE_CONFIG_BACKUP_FORCE_PATH_STYLE=true
    BACKUP_REMOTE="backup:${BACKUP_S3_BUCKET}"
  elif [ -n "${BACKUP_SFTP_HOST:-}" ] && [ -n "${BACKUP_SFTP_USER:-}" ] && [ -n "${BACKUP_SFTP_PASSWORD:-}" ]; then
    # Или по SFTP на другой хостинг (например, Beget: включить SSH-доступ в панели; пароль — от аккаунта хостинга)
    export RCLONE_CONFIG_BACKUP_TYPE=sftp
    export RCLONE_CONFIG_BACKUP_HOST="$BACKUP_SFTP_HOST"
    export RCLONE_CONFIG_BACKUP_USER="$BACKUP_SFTP_USER"
    export RCLONE_CONFIG_BACKUP_PORT="${BACKUP_SFTP_PORT:-22}"
    RCLONE_CONFIG_BACKUP_PASS="$(rclone obscure "$BACKUP_SFTP_PASSWORD")"
    export RCLONE_CONFIG_BACKUP_PASS
    export RCLONE_CONFIG_BACKUP_SHELL_TYPE=unix
    # Не висеть молча, если хостинг недоступен
    export RCLONE_CONTIMEOUT=20s RCLONE_TIMEOUT=2m RCLONE_LOW_LEVEL_RETRIES=2 RCLONE_RETRIES=2
    BACKUP_REMOTE="backup:${BACKUP_SFTP_PATH:-laflamme-backups}"
  fi
}

