import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { MOYSKLAD_MODULE } from "../../modules/moysklad"
import MoyskladModuleService from "../../modules/moysklad/service"
import { MsStore } from "./types"
import { formatCode } from "../gift-cards/rules"

/**
 * Заказ сайта -> «Заказ покупателя» в МоемСкладе (ТЗ, п. 3.4).
 * - контрагент ищется по телефону, затем по email; если нет — создаётся;
 * - позиции — модификации МС с ценами заказа, доставка — отдельной строкой в комментарии;
 * - повторная выгрузка не создаёт дубль (externalCode = id заказа Medusa);
 * - результат пишется в metadata заказа: moysklad_order_id или moysklad_export_error.
 * Выгрузка выключена, пока MOYSKLAD_ORDERS_ENABLED не равен "true".
 */

const API = "https://api.moysklad.ru/api/remap/1.2"
const meta = (type: string, id: string) => ({ meta: { href: `${API}/entity/${type}/${id}`, type, mediaType: "application/json" } })

type OrderRow = {
  id: string
  display_id: number
  email: string | null
  created_at: string
  metadata: Record<string, unknown> | null
  shipping_address?: { first_name?: string; last_name?: string; phone?: string; address_1?: string; city?: string } | null
  shipping_methods?: { name: string; amount: number; shipping_option_id?: string | null }[]
  credit_lines?: { amount: number; reference: string | null; metadata?: Record<string, unknown> | null }[] | null
  items?: {
    id: string
    title: string
    product_title?: string
    variant_title?: string
    quantity: number
    unit_price: number
    adjustments?: { amount: unknown }[] | null
    variant?: { metadata?: Record<string, unknown> | null; product?: { external_id?: string | null; metadata?: Record<string, unknown> | null } | null } | null
  }[]
}

type MsRow = { id: string; meta: { href: string } }

export function ordersExportEnabled(): boolean {
  return process.env.MOYSKLAD_ORDERS_ENABLED === "true"
}

export async function exportOrderToMoysklad(container: MedusaContainer, orderId: string): Promise<{ status: "skipped" | "exists" | "created" | "failed"; msId?: string; error?: string }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderService = container.resolve(Modules.ORDER)
  const ms: MoyskladModuleService = container.resolve(MOYSKLAD_MODULE)

  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "email", "created_at", "metadata",
      "shipping_address.first_name", "shipping_address.last_name", "shipping_address.phone",
      "shipping_address.address_1", "shipping_address.city",
      "shipping_methods.name", "shipping_methods.amount", "shipping_methods.shipping_option_id",
      "items.id", "items.title", "items.product_title", "items.variant_title", "items.quantity", "items.unit_price", "items.adjustments.amount",
      "items.variant.metadata", "items.variant.product.external_id", "items.variant.product.metadata",
      "credit_lines.amount", "credit_lines.reference", "credit_lines.metadata",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as unknown as OrderRow | undefined
  if (!order) return { status: "failed", error: "Заказ не найден" }
  if (order.metadata?.moysklad_order_id) return { status: "exists", msId: order.metadata.moysklad_order_id as string }

  const saveMeta = (patch: Record<string, unknown>) =>
    orderService.updateOrders(order.id, { metadata: { ...(order.metadata ?? {}), ...patch } })

  try {
    // Уже выгружали (например, процесс упал после создания в МС)?
    const existing = await ms.api.get<{ rows: MsRow[] }>("entity/customerorder", { filter: `externalCode=${order.id}` })
    if (existing.rows[0]) {
      await saveMeta({ moysklad_order_id: existing.rows[0].id, moysklad_export_error: null })
      return { status: "exists", msId: existing.rows[0].id }
    }

    const [organization] = (await ms.api.get<{ rows: MsRow[] }>("entity/organization")).rows
    if (!organization) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Не найдено юрлицо в МоемСкладе")
    // Склад заказа (MOYSKLAD_ORDER_STORE, по умолчанию «Партизанская»), иначе — склад остатков сайта
    const stores = await ms.api.listAll<MsStore>("entity/store")
    const store = byName(stores, process.env.MOYSKLAD_ORDER_STORE || "Партизанская") ?? stores.find((x) => x.name === ms.options.storeName)
    if (!store) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Не найден склад в МоемСкладе")
    // Канал продаж (MOYSKLAD_SALES_CHANNEL, по умолчанию «la:flamme»); не нашли — заказ выгружаем без него
    const channelName = process.env.MOYSKLAD_SALES_CHANNEL || "la:flamme"
    const channel = byName(await ms.api.listAll<MsRow & { name: string }>("entity/saleschannel").catch(() => []), channelName)
    if (!channel) logger.warn(`МойСклад: канал продаж «${channelName}» не найден — заказ № ${order.display_id} без канала`)

    const agentId = await findOrCreateCounterparty(ms, order)

    const positions: Record<string, unknown>[] = (order.items ?? []).map((i) => {
      const msId = i.variant?.metadata?.moysklad_id as string | undefined
      if (!msId) throw new MedusaError(MedusaError.Types.INVALID_DATA, `У позиции «${i.title}» нет связи с МоимСкладом`)
      // Товар без модификаций в МС: moysklad_id варианта = id товара
      const type = msId === i.variant?.product?.external_id ? "product" : "variant"
      // Промокод — скидка позиции в процентах (в МС скидка задаётся процентом)
      const full = Number(i.unit_price) * i.quantity
      const off = (i.adjustments ?? []).reduce((s, a) => s + Number(a.amount ?? 0), 0)
      const discount = full > 0 && off > 0 ? Math.min(100, Math.round((off / full) * 100 * 100) / 100) : 0
      return { quantity: i.quantity, price: Math.round(Number(i.unit_price) * 100), discount, reserve: i.quantity, assortment: meta(type, msId) }
    })

    const a = order.shipping_address
    const shipping = order.shipping_methods?.[0]
    // Доставка — отдельной позицией-услугой МС (и при бесплатной — с ценой 0)
    const kind = shipping?.shipping_option_id ? await deliveryKind(container, shipping.shipping_option_id) : null
    const serviceName = kind ? deliveryServiceName(kind) : null
    const service = serviceName ? byName(await ms.api.listAll<MsRow & { name: string }>("entity/service").catch(() => []), serviceName) : undefined
    if (shipping && !service) logger.warn(`МойСклад: услуга доставки «${serviceName ?? shipping.name}» не найдена — заказ № ${order.display_id} без позиции доставки`)
    if (shipping && service) positions.push({ quantity: 1, price: Math.round(Number(shipping.amount) * 100), discount: 0, assortment: { meta: service.meta } })
    const description = [
      `Заказ с сайта № ${order.display_id}`,
      `Получатель: ${[a?.first_name, a?.last_name].filter(Boolean).join(" ")}, ${a?.phone ?? ""}, ${order.email ?? ""}`,
      shipping ? `Получение: ${shipping.name}${Number(shipping.amount) ? `, ${shipping.amount} ₽` : ""}` : null,
      // Подарочная карта — часть оплаты (аванс), цены позиций полные
      ...(order.credit_lines ?? []).filter((l) => l.reference === "gift_card").map((l) => `Оплачено подарочной картой ${formatCode(String(l.metadata?.code ?? ""))}: ${Math.round(Number(l.amount))} ₽`),
      `Оплата: ${order.metadata?.payment_method === "gift" ? "полностью подарочной картой" : order.metadata?.payment_method === "split" ? "Яндекс Сплит, оплачен" : order.metadata?.payment_method === "tbank" ? "онлайн (Т-Касса), оплачен" : order.metadata?.payment_method === "cod" ? "при получении" : "предоплата по ссылке — ждёт оплаты"}${(order.credit_lines ?? []).some((l) => l.reference === "gift_card") && order.metadata?.payment_method !== "gift" ? " (остаток после карты)" : ""}`,
      a?.address_1 && !a.address_1.startsWith("Самовывоз") ? `Адрес: ${a.city ?? ""}, ${a.address_1}` : null,
      order.metadata?.comment ? `Комментарий покупателя: ${order.metadata.comment}` : null,
      order.metadata?.promo_code && (order.items ?? []).some((i) => i.adjustments?.length) ? `Промокод: ${order.metadata.promo_code}` : null,
      ...(order.items ?? []).filter((i) => i.variant?.product?.metadata?.preorder).map((i) => `ПРЕДЗАКАЗ: ${i.product_title ?? i.title} (${i.variant_title ?? ""})`),
    ].filter(Boolean).join("\n")

    const created = await ms.api.post<MsRow>("entity/customerorder", {
      organization: { meta: organization.meta },
      agent: meta("counterparty", agentId),
      store: { meta: store.meta },
      ...(channel ? { salesChannel: { meta: channel.meta } } : {}),
      externalCode: order.id,
      moment: new Date(order.created_at).toLocaleString("sv-SE", { timeZone: "Europe/Moscow" }),
      description,
      positions,
    })
    await saveMeta({ moysklad_order_id: created.id, moysklad_export_error: null, moysklad_exported_at: new Date().toISOString() })
    logger.info(`МойСклад: заказ № ${order.display_id} выгружен (${created.id})`)
    return { status: "created", msId: created.id }
  } catch (e) {
    const error = (e as Error).message
    logger.error(`МойСклад: заказ № ${order.display_id} не выгружен: ${error}`)
    await saveMeta({ moysklad_export_error: error, moysklad_export_attempted_at: new Date().toISOString() })
    return { status: "failed", error }
  }
}

/** Способ получения заказа (код типа варианта доставки: pickup, omsk-courier, cdek-pvz, cdek-door, pochta) */
async function deliveryKind(container: MedusaContainer, optionId: string): Promise<string | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "shipping_option", fields: ["id", "type.code"], filters: { id: optionId } })
  return (data[0] as { type?: { code?: string } | null } | undefined)?.type?.code ?? null
}

/** Услуги доставки в МС по способу получения; переопределяются MOYSKLAD_DELIVERY_SERVICES (JSON: {"pochta": "Почта России"}) */
const DELIVERY_SERVICES: Record<string, string> = {
  "cdek-pvz": "СДЭК",
  "cdek-door": "СДЭК",
  pochta: "Почта",
  "omsk-courier": "Доставка курьером по городу Омск",
  pickup: "Самовывоз из шоурума",
}
export function deliveryServiceName(kind: string): string | null {
  let custom: Record<string, string> = {}
  try { custom = JSON.parse(process.env.MOYSKLAD_DELIVERY_SERVICES || "{}") } catch { /* неверный JSON — стандартные */ }
  return custom[kind] ?? DELIVERY_SERVICES[kind] ?? null
}

/** По названию: точное совпадение, иначе содержит (без учёта регистра и пробелов) — «Партизанская» найдёт «Склад Партизанская» */
function byName<T extends { name: string }>(rows: T[], name: string): T | undefined {
  const n = (x: string) => x.toLowerCase().replace(/\s+/g, "")
  return rows.find((r) => r.name === name) ?? rows.find((r) => n(r.name).includes(n(name)))
}

/** Контрагент по телефону (10 последних цифр), затем по email; иначе — новый физлицо. */
async function findOrCreateCounterparty(ms: MoyskladModuleService, order: OrderRow): Promise<string> {
  const phone = order.shipping_address?.phone ?? ""
  const digits = phone.replace(/\D/g, "").slice(-10)
  if (digits.length === 10) {
    const byPhone = await ms.api.get<{ rows: (MsRow & { phone?: string })[] }>("entity/counterparty", { search: digits, limit: 20 })
    const hit = byPhone.rows.find((r) => (r.phone ?? "").replace(/\D/g, "").endsWith(digits))
    if (hit) return hit.id
  }
  if (order.email) {
    const byEmail = await ms.api.get<{ rows: MsRow[] }>("entity/counterparty", { filter: `email=${order.email}` })
    if (byEmail.rows[0]) return byEmail.rows[0].id
  }
  const a = order.shipping_address
  const created = await ms.api.post<MsRow>("entity/counterparty", {
    name: [a?.last_name, a?.first_name].filter(Boolean).join(" ") || phone || order.email || "Покупатель сайта",
    companyType: "individual",
    phone: phone || undefined,
    email: order.email || undefined,
    description: "Создан сайтом Laflamme",
  })
  return created.id
}
