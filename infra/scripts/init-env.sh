#!/usr/bin/env bash
# Первичное создание infra/.env и infra/.env.backend из шаблонов: пароли и секреты генерируются сами.
# Запуск один раз из папки проекта:
#   SITE_DOMAIN=new.laflamme.ru ADMIN_ALLOW_IPS="1.2.3.4" bash infra/scripts/init-env.sh
# Существующие файлы не перезаписываются. Ключи интеграций (S3, Т-Банк, СДЭК…) потом — nano infra/.env.backend.
set -euo pipefail
cd "$(dirname "$0")/../.."

SITE_DOMAIN="${SITE_DOMAIN:-laflamme.ru}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.laflamme.ru}"
CMS_DOMAIN="${CMS_DOMAIN:-cms.laflamme.ru}"
ADMIN_ALLOW_IPS="${ADMIN_ALLOW_IPS:-127.0.0.1}"

secret() { openssl rand -hex 32; }
# set FILE KEY VALUE — заменить строку KEY=… (значение без переводов строк)
set_var() { local v; v=$(printf '%s' "$3" | sed 's/[&|\\]/\\&/g'); sed -i "s|^$2=.*|$2=$v|" "$1"; }

if [ -f infra/.env ]; then
  echo "infra/.env уже есть — не трогаю"
else
  cp infra/prod.env.template infra/.env
  chmod 600 infra/.env
  set_var infra/.env SITE_DOMAIN "$SITE_DOMAIN"
  set_var infra/.env ADMIN_DOMAIN "$ADMIN_DOMAIN"
  set_var infra/.env CMS_DOMAIN "$CMS_DOMAIN"
  set_var infra/.env ADMIN_ALLOW_IPS "$ADMIN_ALLOW_IPS"
  for k in POSTGRES_PASSWORD JWT_SECRET COOKIE_SECRET PAYLOAD_SECRET REVALIDATE_SECRET BACKUP_PASSPHRASE; do
    set_var infra/.env "$k" "$(secret)"
  done
  echo "Создан infra/.env"
fi

if [ -f infra/.env.backend ]; then
  echo "infra/.env.backend уже есть — не трогаю"
else
  cp infra/backend.env.template infra/.env.backend
  chmod 600 infra/.env.backend
  set_var infra/.env.backend AUTH_MFA_ENCRYPTION_KEY "$(secret)"
  set_var infra/.env.backend MOYSKLAD_WEBHOOK_SECRET "$(openssl rand -hex 24)"
  set_var infra/.env.backend CDEK_WEBHOOK_SECRET "$(openssl rand -hex 24)"
  echo "Создан infra/.env.backend"
fi

echo
echo "Важно: пароль бэкапов (BACKUP_PASSPHRASE) сохраните ещё и у себя — без него копии не расшифровать."
echo "Показать его:  grep ^BACKUP_PASSPHRASE= infra/.env"
