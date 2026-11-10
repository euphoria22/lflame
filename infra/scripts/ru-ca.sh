#!/usr/bin/env bash
# Сертификаты Минцифры (НУЦ): ими подписаны боевые сервисы ряда банков, в т.ч. оплата Т-Банка.
# В стандартном списке Node.js их нет — без них Medusa не может обратиться к Т-Банку.
# Скачиваются с официального сайта gu-st.ru в infra/certs/russian-trusted-ca.pem. Запуск из папки проекта:
#   bash infra/scripts/ru-ca.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p infra/certs
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
for f in russian_trusted_root_ca_pem.crt russian_trusted_sub_ca_pem.crt russian_trusted_sub_ca_2024_pem.crt; do
  if curl -fsS -m 30 "https://gu-st.ru/content/lending/$f" -o "$TMP/$f"; then
    openssl x509 -in "$TMP/$f" -noout >/dev/null 2>&1 || { echo "Не сертификат: $f"; rm -f "$TMP/$f"; }
  else
    echo "Не скачался: $f"
  fi
done
ls "$TMP"/*.crt >/dev/null 2>&1 || { echo "Сертификаты не скачались"; exit 1; }
cat "$TMP"/*.crt > infra/certs/russian-trusted-ca.pem
echo "Сохранено в infra/certs/russian-trusted-ca.pem:"
for f in "$TMP"/*.crt; do openssl x509 -in "$f" -noout -subject -enddate | tr '\n' ' '; echo; done
