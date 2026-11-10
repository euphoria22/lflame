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
