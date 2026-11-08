import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  FulfillmentOption,
} from "@medusajs/framework/types"
import { estimateParcel, ParcelItem } from "../../lib/delivery/parcel"
import { getShopSettings } from "../../lib/settings/shop-settings"
import { applyFreeShipping, applyMarkup, itemsTotal, PricedItem } from "../../lib/delivery/free-shipping"
import { pochtaQuote } from "../../lib/delivery/pochta-client"

/**
 * Провайдер доставки Почтой России (ТЗ, п. 5). Цена — по калькулятору tariff.pochta.ru.
 * data способа доставки (с витрины): postal_code — индекс получателя.
 */
class PochtaFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "pochta"

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [{ id: "pochta-parcel", name: "Почта России — посылка" }]
  }

  async validateOption(): Promise<boolean> {
    return true
  }

  async canCalculate(): Promise<boolean> {
    return true
  }

  async validateFulfillmentData(_optionData: Record<string, unknown>, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const index = String(data.postal_code ?? "")
    if (!/^\d{6}$/.test(index)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Почта: укажите индекс")
    return { postal_code: index }
  }

  async calculatePrice(
    _optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    const index = String(data?.postal_code ?? context.shipping_address?.postal_code ?? "")
    const settings = await getShopSettings()
    const parcel = estimateParcel((context.items ?? []) as unknown as ParcelItem[], settings.parcel)
    const quote = await pochtaQuote(index, parcel.weight)
    return { calculated_amount: applyFreeShipping(applyMarkup(quote.amount, settings.markup.pochta), itemsTotal((context.items ?? []) as unknown as PricedItem[]), settings.free_shipping_from), is_calculated_price_tax_inclusive: true }
  }

  async createFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }

  async cancelFulfillment(): Promise<Record<string, unknown>> {
    return {}
  }

  async createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }
}

export default PochtaFulfillmentProviderService
