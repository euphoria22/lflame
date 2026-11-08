import { MedusaError } from "@medusajs/framework/utils"
import { CDEK_TARIFFS, cdekConfig, cdekRequest } from "./cdek-client"
import { getShopSettings } from "../settings/shop-settings"
import { estimateParcel, itemWeight, ParcelItem } from "./parcel"

/**
 * Регистрация заказа в СДЭК (ТЗ, п. 5.3). Вызывается, когда в админке Medusa создают отправку.
 * Магазин сдаёт посылки в пункт приёма СДЭК (CDEK_SHIPMENT_POINT), тарифы «склад-склад» и «склад-дверь».
 * Если заказ не оплачен онлайн — СДЭК берёт оплату с получателя (наложенный платёж).
 */

export type CdekOrderInput = {
  displayId: number
  kind: "pvz" | "door"
  cityCode: number
  pvzCode?: string | null
  address?: string | null
  recipient: { name: string; phone: string; email?: string | null }
  items: (ParcelItem & { id: string; sku?: string | null; unit_price: number })[]
  /** Сумма доставки, которую СДЭК возьмёт с получателя (0 — если оплачено онлайн или бесплатно) */
  cod: boolean
  shippingAmount: number
  comment?: string | null
}

export type CdekOrderResult = { uuid: string; cdek_number: string | null; tracking_url: string | null; number: string }

type CdekOrderInfo = {
  entity?: { uuid: string; cdek_number?: string; number?: string }
  requests?: { type: string; state: string; errors?: { code: string; message: string }[] }[]
}


export const cdekTrackingUrl = (num: string) => `https://www.cdek.ru/ru/tracking/?order_id=${num}`

/** Тело запроса POST /v2/orders. Вынесено отдельно для тестов. */
export function buildCdekOrder(input: CdekOrderInput, isTest: boolean, shipmentPoint = "OMS6") {
  const parcel = estimateParcel(input.items)
  // В общем тестовом аккаунте номера заказов пересекаются с чужими — добавляем хвост
  const number = `LF-${input.displayId}${isTest ? `-${Date.now().toString(36)}` : ""}`
  return {
    type: 1,
    number,
    tariff_code: input.kind === "pvz" ? CDEK_TARIFFS.pvz : CDEK_TARIFFS.door,
    comment: input.comment || undefined,
    shipment_point: shipmentPoint,
    ...(input.kind === "pvz"
      ? { delivery_point: input.pvzCode }
      : { to_location: { code: input.cityCode, address: input.address } }),
    recipient: {
      name: input.recipient.name,
      phones: [{ number: normalizePhone(input.recipient.phone) }],
      email: input.recipient.email || undefined,
    },
    delivery_recipient_cost: { value: input.cod ? input.shippingAmount : 0 },
    packages: [{
      number: "1",
      weight: parcel.weight,
      length: parcel.length,
      width: parcel.width,
      height: parcel.height,
      items: input.items.map((i) => ({
        name: (i.product_title || i.title || "Товар").slice(0, 255),
        ware_key: (i.sku || i.id).slice(0, 50),
        payment: { value: input.cod ? Number(i.unit_price) : 0 },
        cost: Number(i.unit_price),
        weight: itemWeight(i),
        amount: i.quantity,
      })),
    }],
  }
}

export async function createCdekOrder(input: CdekOrderInput): Promise<CdekOrderResult> {
  const body = buildCdekOrder(input, cdekConfig().baseUrl.includes(".edu."), (await getShopSettings()).cdek_shipment_point)
  const created = await cdekRequest<CdekOrderInfo>("/orders", { method: "POST", body })
  const uuid = created.entity?.uuid
  if (!uuid) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `СДЭК не принял заказ: ${errorsOf(created)}`)

  // СДЭК проверяет заказ асинхронно: ждём результат проверки и номер накладной (до ~20 с).
  // Если номер не успел прийти — его подтянет задача cdek-numbers.
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const info = await cdekRequest<CdekOrderInfo>(`/orders/${uuid}`)
    const req = info.requests?.find((r) => r.type === "CREATE")
    if (req?.state === "INVALID") throw new MedusaError(MedusaError.Types.INVALID_DATA, `СДЭК отклонил заказ: ${errorsOf(info)}`)
    const num = info.entity?.cdek_number
    if (num) return { uuid, cdek_number: num, tracking_url: cdekTrackingUrl(num), number: body.number }
  }
  // Номер придёт позже — его можно увидеть в кабинете СДЭК
  return { uuid, cdek_number: null, tracking_url: null, number: body.number }
}

export async function getCdekOrder(uuid: string): Promise<CdekOrderInfo> {
  return cdekRequest<CdekOrderInfo>(`/orders/${uuid}`)
}

export async function deleteCdekOrder(uuid: string): Promise<void> {
  await cdekRequest(`/orders/${uuid}`, { method: "DELETE" })
}

/** Ярлык (штрихкод-наклейка) в PDF. */
export async function cdekLabelPdf(uuid: string): Promise<ArrayBuffer> {
  const req = await cdekRequest<{ entity?: { uuid: string } }>("/print/barcodes", {
    method: "POST",
    body: { orders: [{ order_uuid: uuid }], copy_count: 1, format: "A6" },
  })
  const printId = req.entity?.uuid
  if (!printId) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "СДЭК: не удалось сформировать ярлык")
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1500))
    const info = await cdekRequest<{ entity?: { url?: string; statuses?: { code: string }[] } }>(`/print/barcodes/${printId}`)
    if (info.entity?.statuses?.some((s) => s.code === "INVALID")) break
    if (info.entity?.url) return cdekRequest<ArrayBuffer>(`/print/barcodes/${printId}.pdf`, { raw: true })
  }
  throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "СДЭК: ярлык не готов, попробуйте ещё раз")
}

function errorsOf(info: CdekOrderInfo): string {
  return info.requests?.flatMap((r) => r.errors ?? []).map((e) => e.message).join("; ") || "неизвестная ошибка"
}

/** Российский номер в формате +7XXXXXXXXXX. */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "")
  if (d.length === 11 && d.startsWith("8")) d = `7${d.slice(1)}`
  if (d.length === 10) d = `7${d}`
  return `+${d}`
}
