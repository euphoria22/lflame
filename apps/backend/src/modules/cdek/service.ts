import { AbstractFulfillmentProviderService, MedusaError } from "@medusajs/framework/utils"
import type {
  CalculatedShippingOptionPrice,
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  FulfillmentOption,
} from "@medusajs/framework/types"
import { CDEK_TARIFFS, cdekQuote } from "../../lib/delivery/cdek-client"
import { estimateParcel, ParcelItem } from "../../lib/delivery/parcel"

/**
 * Провайдер доставки СДЭК (ТЗ, п. 5). Цена считается по API СДЭК на каждый запрос.
 * data способа доставки (с витрины): city_code — код города СДЭК; pvz_code — для пункта выдачи.
 * Создание заказа в СДЭК (createFulfillment) — следующим шагом, после ключей боевого кабинета.
 */
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
    const parcel = estimateParcel((context.items ?? []) as unknown as ParcelItem[])
    const quote = await cdekQuote(Number(optionData.tariff), cityCode, parcel)
    return { calculated_amount: quote.amount, is_calculated_price_tax_inclusive: true }
  }

  async createFulfillment(): Promise<CreateFulfillmentResult> {
    // Регистрация заказа в СДЭК будет добавлена с ключами боевого кабинета
    return { data: {}, labels: [] }
  }

  async cancelFulfillment(): Promise<Record<string, unknown>> {
    return {}
  }

  async createReturnFulfillment(): Promise<CreateFulfillmentResult> {
    return { data: {}, labels: [] }
  }
}

export default CdekFulfillmentProviderService
