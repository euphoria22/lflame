/**
 * Посредник для уведомлений магазина в Telegram (Cloudflare Worker).
 * С серверов в РФ api.telegram.org недоступен; сервер шлёт сообщение сюда, а Worker — в Telegram.
 *
 * Пропускает только отправку сообщения (POST /bot<токен>/sendMessage) и только с секретом
 * в заголовке X-Relay-Secret — он задаётся в настройках Worker как переменная RELAY_SECRET (тип Secret)
 * и на сервере как TELEGRAM_RELAY_SECRET.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method !== "POST" || !/^\/bot\d+:[\w-]+\/sendMessage$/.test(url.pathname)) {
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
