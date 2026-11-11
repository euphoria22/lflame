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

# Хранилище бэкапов S3 (Beget, Selectel, Timeweb…) из переменных BACKUP_S3_* — без ручной настройки rclone.
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
  fi
}

