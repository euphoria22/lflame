/**
 * События листингов для умной сортировки (ТЗ сортировки, раздел 2): показ, клик, корзина, визит листинга.
 * Без cookie и идентификаторов покупателя: на сервер уходят только счётчики «карточка — листинг — позиция».
 * События копятся и отправляются пачкой раз в несколько секунд и при уходе со страницы.
 */
type Ev = { t: "i" | "c" | "a" | "v"; p?: string; l: string; pos?: number }

const queue: Ev[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let bound = false
const CLICK_KEY = "lf_listing_clicks"

function flush() {
  if (timer) { clearTimeout(timer); timer = null }
  if (!queue.length) return
  const body = JSON.stringify({ events: queue.splice(0, 200) })
  try {
    if (!navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => null)
    }
  } catch {
    // статистика не должна мешать сайту
  }
}

function push(e: Ev) {
  queue.push(e)
  if (!bound) {
    bound = true
    window.addEventListener("pagehide", flush)
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush() })
  }
  if (queue.length >= 40) flush()
  else if (!timer) timer = setTimeout(flush, 4000)
}

const seen = new Set<string>()

/** Показ: карточка видна на экране не меньше чем наполовину в течение секунды. Один раз за загрузку страницы */
export function trackImpression(listing: string, pid: string, pos: number) {
  const k = `${listing}|${pid}`
  if (seen.has(k)) return
  seen.add(k)
  push({ t: "i", p: pid, l: listing, pos })
}

/** Визит листинга: один раз за загрузку страницы */
export function trackVisit(listing: string) {
  const k = `visit|${listing}|${location.pathname}${location.search}`
  if (seen.has(k)) return
  seen.add(k)
  push({ t: "v", l: listing })
}

type Clicks = Record<string, { l: string; at: number }>
const readClicks = (): Clicks => {
  try { return JSON.parse(sessionStorage.getItem(CLICK_KEY) ?? "{}") as Clicks } catch { return {} }
}

/** Клик: переход из листинга в карточку. Запоминаем до конца сессии — для события «корзина» */
export function trackClick(listing: string, pid: string, pos: number) {
  push({ t: "c", p: pid, l: listing, pos })
  try {
    const c = readClicks()
    c[pid] = { l: listing, at: Date.now() }
    c._last = { l: pid, at: Date.now() }
    sessionStorage.setItem(CLICK_KEY, JSON.stringify(c))
  } catch {
    // закрытое хранилище — корзина просто не засчитается
  }
  flush()
}

/**
 * Корзина: добавление в той же сессии после клика из листинга. pid — товар (со страницы товара);
 * без pid — последний товар, по которому кликнули в листинге (быстрые размеры на карточке), не позже минуты назад.
 */
export function trackCart(pid?: string) {
  const c = readClicks()
  const id = pid ?? (c._last && Date.now() - c._last.at < 60_000 ? c._last.l : undefined)
  const hit = id ? c[id] : undefined
  if (!id || !hit) return
  push({ t: "a", p: id, l: hit.l })
  // Одна корзина на клик
  delete c[id]
  try { sessionStorage.setItem(CLICK_KEY, JSON.stringify(c)) } catch { /* не важно */ }
}
