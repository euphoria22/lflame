#!/usr/bin/env bash
# Первичная настройка бэкапов: проверка настроек, пароль шифрования, пробный бэкап в хранилище, расписание.
#   bash infra/scripts/backup-setup.sh
# Перед запуском сохраните в infra/.env (bash infra/scripts/set-secret.sh ИМЯ infra/.env):
#   S3: BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY, BACKUP_S3_SECRET_KEY (и при необходимости BACKUP_S3_REGION)
#   или SFTP (Beget-хостинг): BACKUP_SFTP_HOST, BACKUP_SFTP_USER, BACKUP_SFTP_PASSWORD (папка — BACKUP_SFTP_PATH, по умолчанию laflamme-backups)
set -euo pipefail
cd "$(dirname "$0")/../.."
. infra/scripts/lib-env.sh; load_env infra/.env

# Хранилище: S3 (BACKUP_S3_*) или SFTP на другой хостинг (BACKUP_SFTP_HOST, BACKUP_SFTP_USER, BACKUP_SFTP_PASSWORD)
missing=()
if [ -n "${BACKUP_SFTP_HOST:-}${BACKUP_SFTP_USER:-}${BACKUP_SFTP_PASSWORD:-}" ]; then
  for k in BACKUP_SFTP_HOST BACKUP_SFTP_USER BACKUP_SFTP_PASSWORD; do [ -n "${!k:-}" ] || missing+=("$k"); done
else
  for k in BACKUP_S3_ENDPOINT BACKUP_S3_BUCKET BACKUP_S3_ACCESS_KEY BACKUP_S3_SECRET_KEY; do [ -n "${!k:-}" ] || missing+=("$k"); done
fi
if [ ${#missing[@]} -gt 0 ]; then
  echo "Не хватает настроек в infra/.env: ${missing[*]}"
  echo "Сохраните каждую командой: bash infra/scripts/set-secret.sh ИМЯ infra/.env"
  exit 1
fi
command -v rclone >/dev/null || { echo "Устанавливаю rclone…"; sudo apt-get install -y rclone; }
command -v gpg >/dev/null || { echo "Устанавливаю gpg…"; sudo apt-get install -y gpg; }

# Пароль шифрования: нет — создаём и показываем один раз
if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
  PASS="$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-32)"
  if grep -q '^BACKUP_PASSPHRASE=' infra/.env; then sed -i "s|^BACKUP_PASSPHRASE=.*|BACKUP_PASSPHRASE=$PASS|" infra/.env; else echo "BACKUP_PASSPHRASE=$PASS" >> infra/.env; fi
  echo
  echo "================================================================"
  echo " Создан пароль шифрования бэкапов. СОХРАНИТЕ его в надёжном месте"
  echo " (менеджер паролей, бумага в сейфе) — без него бэкап не открыть:"
  echo
  echo "   $PASS"
  echo
  echo "================================================================"
  read -r -p "Сохранили пароль? Напишите ДА: " ok
  [ "$ok" = "ДА" ] || { echo "Пароль уже записан в infra/.env — запустите скрипт снова, когда сохраните его"; exit 1; }
fi

echo "Проверяю доступ к хранилищу…"
load_env infra/.env; setup_backup_remote
rclone lsd "$BACKUP_REMOTE" >/dev/null 2>&1 || rclone mkdir "$BACKUP_REMOTE"
rclone lsf "$BACKUP_REMOTE" >/dev/null || { echo "Нет доступа к хранилищу $BACKUP_REMOTE — проверьте адрес, логин/ключи и (для Beget) что SSH-доступ включён"; exit 1; }
echo "Хранилище доступно."

echo "Пробный бэкап…"
bash infra/scripts/backup.sh setup
echo "Файлы в хранилище:"
rclone lsl "$BACKUP_REMOTE" | tail -5

# Расписание: бэкап каждые 6 часов и проверка сайта раз в минуту (если ещё нет)
DIR="$(pwd)"
CUR="$(crontab -l 2>/dev/null || true)"
NEW="$CUR"
grep -q 'infra/scripts/backup.sh' <<<"$CUR" || NEW="$NEW"$'\n'"15 */6 * * * cd $DIR && bash infra/scripts/backup.sh >> $HOME/backup.log 2>&1"
grep -q 'infra/scripts/monitor.sh' <<<"$CUR" || NEW="$NEW"$'\n'"* * * * * cd $DIR && bash infra/scripts/monitor.sh >/dev/null 2>&1"
if [ "$NEW" != "$CUR" ]; then printf '%s\n' "$NEW" | sed '/^$/d' | crontab -; echo "Расписание добавлено (crontab -l — посмотреть)."; else echo "Расписание уже настроено."; fi
echo
echo "Готово: бэкап каждые 6 часов, хранение 30 дней в хранилище и 7 дней на сервере."
echo "Если бэкап не дойдёт до хранилища — придёт сообщение в Telegram."
