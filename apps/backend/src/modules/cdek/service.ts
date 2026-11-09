import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  FulfillmentOption,
} from "@medusajs/framework/types"
import { CDEK_TARIFFS, cdekQuote } from "../../lib/delivery/cdek-client"
import { CdekOrderInput, createCdekOrder, deleteCdekOrder } from "../../lib/delivery/cdek-orders"
import { estimateParcel, ParcelItem } from "../../lib/delivery/parcel"
import { getShopSettings } from "../../lib/settings/shop-settings"
import { applyFreeShipping, applyMarkup, cartGoodsTotal } from "../../lib/delivery/free-shipping"

/**
 * Провайдер доставки СДЭК (ТЗ, п. 5). Цена считается по API СДЭК на каждый запрос.
 * data способа доставки (с витрины): city_code — код города СДЭК; pvz_code — для пункта выдачи.
 * При создании отправки в админке заказ регистрируется в СДЭК (номер накладной и ярлык — в отправке).
 */
type FulfillmentOrder = {
  display_id?: number
  email?: string | null
  customer?: { email?: string | null } | null
  metadata?: Record<string, unknown> | null
  shipping_address?: { first_name?: string; last_name?: string; phone?: string; address_1?: string } | null
  shipping_methods?: { amount?: unknown }[]
  items?: { id: string; title?: string; product_title?: string; variant_sku?: string | null; unit_price?: unknown; variant?: { weight?: number | null } | null }[]
}

class CdekFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "cdek"

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      { id: "cdek-pvz", name: "СДЭК — пункт выдачи", tariff: CDEK_TARIFFS.pvz, kind: "pvz" },
      { id: "cdek-door", name: "СДЭК — курьер", tariff: CDEK_TARIFFS.door, kind: "door" },
    ]
  }

  async validateOption(): Promise<boolean> {
    return true
  }

  async canCalculate(): Promise<boolean> {
    return true
  }

  async validateFulfillmentData(optionData: Record<string, unknown>, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const cityCode = Number(data.city_code)
    if (!cityCode) throw new MedusaError(MedusaError.Types.INVALID_DATA, "СДЭК: не выбран город")
    if (optionData.kind === "pvz" && !data.pvz_code) throw new MedusaError(MedusaError.Types.INVALID_DATA, "СДЭК: не выбран пункт выдачи")
    return { city_code: cityCode, pvz_code: data.pvz_code ?? null, pvz_address: data.pvz_address ?? null, city: data.city ?? null }
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    const cityCode = Number(data?.city_code)
    if (!cityCode) throw new MedusaError(MedusaError.Types.INVALID_DATA, "СДЭК: не выбран город")
    const settings = await getShopSettings()
    const parcel = estimateParcel((context.items ?? []) as unknown as ParcelItem[], settings.parcel)
    const tariff = optionData.kind === "pvz" ? settings.cdek_tariff_pvz : settings.cdek_tariff_door
    const quote = await cdekQuote(tariff, cityCode, parcel)
    return { calculated_amount: applyFreeShipping(applyMarkup(quote.amount, settings.markup.cdek), await cartGoodsTotal(context as unknown as { id?: string; items?: unknown[] }),
      settings.free_shipping_methods.includes(optionData.kind === "pvz" ? "cdek-pvz" : "cdek-door") ? settings.free_shipping_from : 0), is_calculated_price_tax_inclusive: true }
  }

  async createFulfillment(
    data: Record<string, unknown>,
    items: Record<string, unknown>[],
    order: Record<string, unknown> | undefined,
    fulfillment: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    const o = (order ?? {}) as unknown as FulfillmentOrder
    const addr = (fulfillment.delivery_address ?? o.shipping_address ?? {}) as FulfillmentOrder["shipping_address"]
    const byLine = new Map((o.items ?? []).map((i) => [i.id, i]))
    const lines = items.map((fi) => {
      const li = byLine.get(String(fi.line_item_id))
      return {
        id: String(fi.line_item_id ?? fi.id),
        title: String(fi.title ?? li?.title ?? ""),
        product_title: li?.product_title ?? null,
        sku: (fi.sku as string) || li?.variant_sku || null,
        quantity: Number(fi.quantity ?? 1),
        unit_price: Number(li?.unit_price ?? 0),
        variant: { weight: li?.variant?.weight ?? null },
      }
    })
    // Наложенный платёж — только если покупатель выбрал «оплата при получении»
    const cod = o.metadata?.payment_method === "cod"
    const shipping = (o.shipping_methods ?? []).reduce((s, m) => s + Number(m.amount ?? 0), 0)
    const input: CdekOrderInput = {
      displayId: Number(o.display_id ?? 0),
      kind: data.pvz_code ? "pvz" : "door",
      cityCode: Number(data.city_code),
      pvzCode: (data.pvz_code as string) ?? null,
      address: addr?.address_1 ?? null,
      recipient: {
        name: [addr?.first_name, addr?.last_name].filter(Boolean).join(" ") || "Получатель",
        phone: addr?.phone ?? "",
        email: o.email ?? o.customer?.email ?? null,
      },
      items: lines,
      cod,
      shippingAmount: shipping,
      comment: `Заказ Laflamme № ${o.display_id}`,
    }
    const r = await createCdekOrder(input)
    return {
      data: { ...data, cdek_uuid: r.uuid, cdek_number: r.cdek_number, cdek_order_number: r.number, cod: input.cod, cdek_status: "ACCEPTED", cdek_status_name: "Принят" },
      labels: r.cdek_number
        ? [{ tracking_number: r.cdek_number, tracking_url: r.tracking_url ?? "", label_url: `/admin/cdek/label/${r.uuid}` }]
        : [],
    }
  }

  async cancelFulfillment(fulfillment: Record<string, unknown>): Promise<Record<string, unknown>> {
    const data = (fulfillment.data ?? fulfillment) as Record<string, unknown>
    if (data.cdek_uuid) await deleteCdekOrder(String(data.cdek_uuid))
    return {}
  }

  async createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }
}

export default CdekFulfillmentProviderService
