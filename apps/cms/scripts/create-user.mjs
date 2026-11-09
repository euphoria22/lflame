/**
 * Пользователь CMS из консоли: создаёт нового или меняет пароль существующему.
 * Запуск из папки apps/cms:  npm run create-user -- почта@пример.ru Пароль123
 * Нужен файл .env с PAYLOAD_DATABASE_URL и хотя бы один запуск CMS (чтобы появились таблицы).
 */
import crypto from "crypto"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import pg from "pg"

const dir = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(dir, "..", ".env")
const env = {}
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

const [email, password] = process.argv.slice(2)
if (!email || !password || !/^\S+@\S+\.\S+$/.test(email)) {
  console.log("Как запустить:  npm run create-user -- почта@пример.ru Пароль123")
  process.exit(1)
}
const url = process.env.PAYLOAD_DATABASE_URL || env.PAYLOAD_DATABASE_URL
if (!url) {
  console.log("Нет PAYLOAD_DATABASE_URL в apps/cms/.env")
  process.exit(1)
}

// Тот же формат, что у Payload: PBKDF2-SHA256, 600 000 итераций
const salt = crypto.randomBytes(32).toString("hex")
const hash = `pbkdf2-sha256-v1:${crypto.pbkdf2Sync(password, salt, 600000, 32, "sha256").toString("hex")}`

const client = new pg.Client({ connectionString: url })
try {
  await client.connect()
} catch (e) {
  console.log(`Не удалось подключиться к базе CMS: ${e.message}`)
  console.log("Проверьте пароль в строке PAYLOAD_DATABASE_URL (apps/cms/.env) — он такой же, как в DATABASE_URL бэкенда.")
  process.exit(1)
}
try {
  const res = await client.query(
    `insert into users (email, salt, hash, login_attempts, lock_until) values ($1, $2, $3, 0, null)
     on conflict (email) do update set salt = excluded.salt, hash = excluded.hash, login_attempts = 0, lock_until = null, updated_at = now()
     returning (xmax = 0) as created`,
    [email.toLowerCase(), salt, hash],
  )
  console.log(res.rows[0].created ? `Готово: создан пользователь ${email}` : `Готово: пароль для ${email} изменён`)
  console.log("Вход: http://localhost:3001/cms")
} catch (e) {
  if (e.code === "42P01") console.log("В базе ещё нет таблиц CMS. Запустите проект (npm run dev), откройте http://localhost:3001/cms один раз и повторите.")
  else console.log(`Ошибка: ${e.message}`)
  process.exit(1)
} finally {
  await client.end()
}
