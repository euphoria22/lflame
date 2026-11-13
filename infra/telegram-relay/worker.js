/**
 * Посредник для Telegram (Cloudflare Worker): уведомления магазину и посты в канал.
 * С серверов в РФ api.telegram.org недоступен; сервер шлёт запрос сюда, а Worker — в Telegram.
 *
 * Пропускает только нужные методы (сообщение, альбом с фото, правка подписи поста) и только с секретом
 * в заголовке X-Relay-Secret — он задаётся в настройках Worker как переменная RELAY_SECRET (тип Secret)
 * и на сервере как TELEGRAM_RELAY_SECRET.
 */
const METHODS = ["sendMessage", "sendMediaGroup", "sendPhoto", "editMessageCaption", "getChat"]

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const m = /^\/bot\d+:[\w-]+\/(\w+)$/.exec(url.pathname)
    if (request.method !== "POST" || !m || !METHODS.includes(m[1])) {
      return new Response("Not found", { status: 404 })
    }
    if (!env.RELAY_SECRET || request.headers.get("x-relay-secret") !== env.RELAY_SECRET) {
      return new Response("Forbidden", { status: 403 })
    }
    const res = await fetch(`https://api.telegram.org${url.pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
    })
    return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } })
  },
}
