import { container } from "@medusajs/framework"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { DEFAULT_PARCEL, ParcelConfig, validateParcelConfig, withDefaultDims } from "../delivery/parcel"
import { Markup, NO_MARKUP } from "../delivery/free-shipping"

/**
 * Настройки магазина, которые меняются в админке («Доставка и оплата»).
 * Хранятся в metadata магазина (store.metadata.shop_settings). Значения из .env — по умолчанию.
 * Кэш 30 секунд, после сохранения в админке сбрасывается сразу.
 */
export type ShopSettings = {
  /** Бесплатная доставка СДЭК и Почтой от суммы товаров, ₽ (0 — выключено) */
  free_shipping_from: number
  /** Пункт СДЭК, куда магазин сдаёт посылки */
  cdek_shipment_point: string
  /** Тариф СДЭК до пункта выдачи (136 — «Посылка склад-склад») */
  cdek_tariff_pvz: number
  /** Тариф СДЭК курьером (137 — «Посылка склад-дверь») */
  cdek_tariff_door: number
  /** Режимы выбранных тарифов (4 склад-склад, 2 дверь-склад, 3 склад-дверь, 1 дверь-дверь) */
  cdek_tariff_pvz_mode: number
  cdek_tariff_door_mode: number
  /** Адрес магазина для тарифов «от двери» (курьер СДЭК забирает посылку) */
  sender_address: string
  /** Для каких способов действует бесплатная доставка от суммы */
  free_shipping_methods: string[]
  /** Оплата: предоплата по ссылке от менеджера; при получении — только для перечисленных способов */
  payments: { manual: boolean; cod_methods: string[] }
  /** Наценка на доставку для покупателя (к цене перевозчика) */
  markup: { cdek: Markup; pochta: Markup }
  /** Вес и коробка по умолчанию — если у товара не заполнены */
  parcel: ParcelConfig
  /** Подписка на новости: включена ли форма и скидка по одноразовому промокоду (0 — без промокода) */
  newsletter: { enabled: boolean; discount_pct: number }
  /** Как способы получения выглядят на сайте при оформлении: название, описание, логотип (пусто — значок по умолчанию) */
  delivery_texts: Record<DeliveryKind, DeliveryText>
  /** Логотипы способов оплаты в подвале сайта (без картинки — название текстом) */
  payment_logos: PaymentLogo[]
}

export type PaymentLogo = { name: string; logo: string | null }
export const DEFAULT_PAYMENT_LOGOS: PaymentLogo[] = ["Visa", "Mastercard", "МИР", "СБП", "T-Pay", "Яндекс Сплит"].map((name) => ({ name, logo: null }))

export const DELIVERY_KINDS = ["pickup", "omsk-courier", "cdek-pvz", "cdek-door", "pochta"] as const
export type DeliveryKind = (typeof DELIVERY_KINDS)[number]
export type DeliveryText = { title: string; hint: string; logo: string | null }

export const DEFAULT_DELIVERY_TEXTS: Record<DeliveryKind, DeliveryText> = {
  "pickup": { title: "Самовывоз из магазина", hint: "Омск, ул. Партизанская, 5а/8, ежедневно с 12:00 до 21:00", logo: null },
  "omsk-courier": { title: "Курьер по Омску", hint: "1–3 часа, время согласуем по телефону", logo: null },
  "cdek-pvz": { title: "СДЭК — пункт выдачи", hint: "Доставка до пункта выдачи СДЭК", logo: null },
  "cdek-door": { title: "СДЭК — курьер", hint: "Курьер привезёт заказ по адресу", logo: null },
  "pochta": { title: "Почта России", hint: "Посылка до почтового отделения", logo: null },
}

export function defaultSettings(): ShopSettings {
  const free = Number(process.env.FREE_SHIPPING_FROM ?? 12000)
  return {
    free_shipping_from: Number.isFinite(free) && free > 0 ? free : 0,
    cdek_shipment_point: process.env.CDEK_SHIPMENT_POINT || "OMS6",
    cdek_tariff_pvz: 136,
    cdek_tariff_door: 137,
    cdek_tariff_pvz_mode: 4,
    cdek_tariff_door_mode: 3,
    sender_address: "ул. Партизанская, 5а/8",
    parcel: DEFAULT_PARCEL,
    markup: { cdek: NO_MARKUP, pochta: NO_MARKUP },
    // Условия магазина: бесплатно от суммы — СДЭК до пункта выдачи и обычная Почта
    free_shipping_methods: ["cdek-pvz", "pochta"],
    // Только предоплата: наложенным платежом не работаем
    payments: { manual: true, cod_methods: [] },
    newsletter: { enabled: true, discount_pct: 10 },
    delivery_texts: DEFAULT_DELIVERY_TEXTS,
    payment_logos: DEFAULT_PAYMENT_LOGOS,
  }
}

let cache: { value: ShopSettings; at: number } | null = null

type StoreRow = { id: string; metadata?: Record<string, unknown> | null }

async function firstStore(): Promise<StoreRow | null> {
  const stores = (await container.resolve(Modules.STORE).listStores({}, { take: 1 })) as StoreRow[]
  return stores[0] ?? null
}

export async function getShopSettings(): Promise<ShopSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value
  const defaults = defaultSettings()
  try {
    const saved = ((await firstStore())?.metadata?.shop_settings ?? {}) as Partial<ShopSettings>
    const value = { ...defaults, ...saved, parcel: { ...defaults.parcel, ...(saved.parcel ?? {}), weights: withDefaultDims(saved.parcel?.weights ?? defaults.parcel.weights) }, markup: { ...defaults.markup, ...(saved.markup ?? {}) }, payments: { ...defaults.payments, ...(saved.payments ?? {}) }, newsletter: { ...defaults.newsletter, ...(saved.newsletter ?? {}) },
      delivery_texts: Object.fromEntries(DELIVERY_KINDS.map((k) => [k, { ...defaults.delivery_texts[k], ...(saved.delivery_texts?.[k] ?? {}) }])) as Record<DeliveryKind, DeliveryText> }
    cache = { value, at: Date.now() }
    return value
  } catch {
    // Контейнер ещё не готов (тесты, скрипты) — значения из .env
    return defaults
  }
}

export function validateSettings(input: Partial<ShopSettings>): { value?: Partial<ShopSettings>; error?: string } {
  const out: Partial<ShopSettings> = {}
  if (input.free_shipping_from !== undefined) {
    const n = Number(input.free_shipping_from)
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return { error: "Сумма бесплатной доставки: число от 0" }
    out.free_shipping_from = Math.round(n)
  }
  if (input.cdek_shipment_point !== undefined) {
    const code = String(input.cdek_shipment_point).trim().toUpperCase()
    if (!/^[A-Z0-9_-]{2,20}$/.test(code)) return { error: "Код пункта СДЭК, например OMS6" }
    out.cdek_shipment_point = code
  }
  for (const [k, ok] of [["cdek_tariff_pvz_mode", [2, 4, 6, 7]], ["cdek_tariff_door_mode", [1, 3]]] as const) {
    if (input[k] === undefined) continue
    const n = Number(input[k])
    if (!(ok as readonly number[]).includes(n)) return { error: k === "cdek_tariff_pvz_mode" ? "Тариф до пункта выдачи должен быть «…-склад» или «…-постамат»" : "Тариф курьером должен быть «…-дверь»" }
    out[k] = n
  }
  if (input.sender_address !== undefined) {
    const a = String(input.sender_address).trim()
    if (a.length < 5 || a.length > 200) return { error: "Адрес магазина: от 5 до 200 символов" }
    out.sender_address = a
  }
  for (const k of ["cdek_tariff_pvz", "cdek_tariff_door"] as const) {
    if (input[k] === undefined) continue
    const n = Number(input[k])
    if (!Number.isInteger(n) || n < 1 || n > 9999) return { error: "Код тарифа СДЭК — целое число" }
    out[k] = n
  }
  if (input.markup !== undefined) {
    const m: { cdek: Markup; pochta: Markup } = { cdek: NO_MARKUP, pochta: NO_MARKUP }
    for (const k of ["cdek", "pochta"] as const) {
      const x = input.markup?.[k] ?? NO_MARKUP
      const type = x.type === "pct" ? "pct" : "rub"
      const value = Math.round(Number(x.value) * 100) / 100
      const max = type === "pct" ? 300 : 10000
      if (!Number.isFinite(value) || value < 0 || value > max) return { error: `Наценка: от 0 до ${max} ${type === "pct" ? "%" : "₽"}` }
      m[k] = { type, value }
    }
    out.markup = m
  }
  const KINDS = ["pickup", "omsk-courier", "cdek-pvz", "cdek-door", "pochta"]
  if (input.free_shipping_methods !== undefined) {
    if (!Array.isArray(input.free_shipping_methods)) return { error: "Способы бесплатной доставки: неверный формат" }
    out.free_shipping_methods = [...new Set(input.free_shipping_methods.map(String).filter((k) => KINDS.includes(k)))]
  }
  if (input.delivery_texts !== undefined) {
    const t = {} as Record<DeliveryKind, DeliveryText>
    for (const k of DELIVERY_KINDS) {
      const x = input.delivery_texts?.[k] ?? DEFAULT_DELIVERY_TEXTS[k]
      const title = String(x.title ?? "").trim()
      const hint = String(x.hint ?? "").trim()
      const logo = String(x.logo ?? "").trim()
      if (!title || title.length > 80) return { error: "Название способа получения: от 1 до 80 символов" }
      if (hint.length > 200) return { error: "Описание способа получения: не длиннее 200 символов" }
      if (logo && !/^(https:\/\/|\/)[^\s"'<>]+$/.test(logo)) return { error: "Логотип: загрузите картинку или укажите ссылку https://" }
      t[k] = { title, hint, logo: logo || null }
    }
    out.delivery_texts = t
  }
  if (input.payment_logos !== undefined) {
    if (!Array.isArray(input.payment_logos) || input.payment_logos.length > 12) return { error: "Логотипы оплаты: не больше 12" }
    const list: PaymentLogo[] = []
    for (const x of input.payment_logos) {
      const name = String(x?.name ?? "").trim()
      const logo = String(x?.logo ?? "").trim()
      if (!name || name.length > 40) return { error: "Название способа оплаты: от 1 до 40 символов" }
      if (logo && !/^(https:\/\/|\/)[^\s"'<>]+$/.test(logo)) return { error: "Логотип оплаты: загрузите картинку" }
      list.push({ name, logo: logo || null })
    }
    out.payment_logos = list
  }
  if (input.newsletter !== undefined) {
    const n = input.newsletter ?? {}
    const pct = Math.round(Number(n.discount_pct ?? 0))
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) return { error: "Скидка за подписку: от 0 до 50%" }
    out.newsletter = { enabled: Boolean(n.enabled), discount_pct: pct }
  }
  if (input.payments !== undefined) {
    const p = input.payments ?? {}
    out.payments = {
      manual: Boolean(p.manual),
      cod_methods: Array.isArray(p.cod_methods) ? [...new Set(p.cod_methods.map(String).filter((k) => KINDS.includes(k)))] : [],
    }
  }
  if (input.parcel !== undefined) {
    const r = validateParcelConfig(input.parcel)
    if (r.error) return { error: r.error }
    out.parcel = r.value
  }
  return { value: out }
}

export async function saveShopSettings(patch: Partial<ShopSettings>): Promise<ShopSettings> {
  const store = await firstStore()
  if (!store) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Магазин не найден")
  const current = { ...defaultSettings(), ...((store.metadata?.shop_settings ?? {}) as Partial<ShopSettings>), ...patch }
  await container.resolve(Modules.STORE).updateStores(store.id, { metadata: { ...(store.metadata ?? {}), shop_settings: current } })
  cache = { value: current, at: Date.now() }
  return current
}
