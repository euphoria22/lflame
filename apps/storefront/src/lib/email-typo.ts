/**
 * Подсказка при опечатке в адресе почты: «gmail.con» → «gmail.com», «mail.tu» → «mail.ru».
 * Только популярные почтовые сервисы: незнакомый домен не трогаем — он может быть настоящим.
 */
const DOMAINS = [
  "gmail.com", "mail.ru", "yandex.ru", "ya.ru", "bk.ru", "inbox.ru", "list.ru", "internet.ru", "rambler.ru",
  "icloud.com", "me.com", "outlook.com", "hotmail.com", "yahoo.com", "yandex.com", "proton.me", "mail.com",
  "yandex.kz", "yandex.by", "yandex.ua", "rambler.ua", "mail.ua", "ukr.net", "tut.by",
]

/** Расстояние Левенштейна (сколько букв поправить) */
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = cur
    }
  }
  return row[b.length]
}

/** Исправленный адрес или null, если ошибки не видно */
export function suggestEmail(input: string): string | null {
  const email = input.trim().toLowerCase()
  const at = email.lastIndexOf("@")
  if (at < 1) return null
  const domain = email.slice(at + 1)
  if (!domain || DOMAINS.includes(domain)) return null
  // Верное имя, не та зона: gmail.ru → gmail.com
  const name = domain.split(".")[0]
  const sameName = DOMAINS.find((d) => d.split(".")[0] === name)
  if (sameName && name.length > 3) return `${email.slice(0, at)}@${sameName}`
  // Ближайший популярный домен; для коротких (ya.ru, bk.ru) — не больше одной правки
  let best: string | null = null
  let bestD = Infinity
  for (const d of DOMAINS) {
    const dist = distance(domain, d)
    if (dist < bestD) { best = d; bestD = dist }
  }
  if (!best || bestD > (best.length <= 6 ? 1 : 2)) return null
  return `${email.slice(0, at)}@${best}`
}
