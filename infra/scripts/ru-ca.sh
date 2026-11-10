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
# Каждый сертификат — через openssl: чистый PEM с переводом строки. Простая склейка файлов без \n в конце
# ломает файл, и Node.js молча игнорирует его целиком («bad end line»)
: > "$TMP/all.pem"
for f in "$TMP"/*.crt; do openssl x509 -in "$f" -outform PEM >> "$TMP/all.pem"; done
mv "$TMP/all.pem" infra/certs/russian-trusted-ca.pem
chmod 644 infra/certs/russian-trusted-ca.pem
echo "Сохранено в infra/certs/russian-trusted-ca.pem:"
for f in "$TMP"/*.crt; do openssl x509 -in "$f" -noout -subject -enddate | tr '\n' ' '; echo; done
# Проверка: с этими сертификатами соединение с оплатой Т-Банка должно проходить
if echo | openssl s_client -connect securepay.tinkoff.ru:443 -servername securepay.tinkoff.ru -CAfile infra/certs/russian-trusted-ca.pem 2>/dev/null | grep -q "Verify return code: 0"; then
  echo "Проверка: сертификат Т-Банка проходит — OK"
else
  echo "Проверка: сертификат Т-Банка НЕ проходит"; exit 1
fi
