import { AbstractPaymentProvider, BigNumber, MedusaError, PaymentActions } from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import type { ReceiptLine } from "../../lib/payments/tbank-client"
import {
  buildCart, money, toSessionStatus, YANDEX_PAY_PROD, YANDEX_PAY_SANDBOX, yandexPayCall, YandexOrder, YandexPayConfig,
} from "../../lib/payments/yandex-pay-client"

type Options = { apiKey?: string; sandbox?: boolean }

type SessionInput = {
  session_id?: string
  success_url?: string
  fail_url?: string
  description?: string
  email?: string
  phone?: string
  receipt?: ReceiptLine[]
}

/** Номер заказа в Яндекс Пэй: id платёжной сессии Medusa + номер попытки (сумму созданного заказа не изменить). */
const yandexOrderId = (sessionId: string, attempt: number) => (attempt > 1 ? `${sessionId}.${attempt}` : sessionId)
export const sessionIdOf = (orderId: string) => orderId.split(".")[0]

/**
 * Оплата частями — Яндекс Сплит (через Яндекс Пэй).
 * Покупатель уходит на форму Яндекс Пэй (paymentUrl) и возвращается на витрину (/checkout/paid);
 * статус проверяется запросом заказа и приходит уведомлением на /hooks/yandex-split/v1/webhook.
 */
class YandexSplitPaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "yandex"

  protected logger: Logger
  protected cfg: YandexPayConfig

  constructor(container: { logger: Logger }, options: Options) {
    super(container, options)
    this.logger = container.logger
    this.cfg = { apiUrl: options.sandbox ? YANDEX_PAY_SANDBOX : YANDEX_PAY_PROD, apiKey: options.apiKey ?? "" }
  }

  private ensureConfigured() {
    if (!this.cfg.apiKey) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Сплит не настроен (YANDEX_PAY_API_KEY)")
  }

  private async create(amount: number, input: SessionInput, attempt: number) {
    this.ensureConfigured()
    if (!input.session_id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Сплит: нет id платёжной сессии")
    const lines = input.receipt?.length ? input.receipt : [{ name: input.description ?? "Заказ Laflamme", price: amount, quantity: 1 }]
    const orderId = yandexOrderId(input.session_id, attempt)
    const cart = buildCart(lines)
    // Сумма корзины должна совпасть с суммой платежа до копейки
    if (cart.total.amount !== money(amount)) cart.total.amount = money(amount)
    const r = await yandexPayCall<{ paymentUrl: string }>(this.cfg, "POST", "/v1/orders", {
      orderId,
      currencyCode: "RUB",
      cart,
      availablePaymentMethods: ["CARD", "SPLIT"],
      preferredPaymentMethod: "SPLIT",
      redirectUrls: { onSuccess: input.success_url, onError: input.fail_url, onAbort: input.fail_url },
      purpose: (input.description ?? "Заказ в магазине Laflamme").slice(0, 1000),
      orderSource: "WEBSITE",
      ttl: 3600,
      ...(input.phone ? { billingPhone: input.phone } : {}),
      ...(input.email || input.phone ? { fiscalContact: input.email || input.phone } : {}),
    }, orderId)
    return { ...input, receipt: undefined, attempt, yandex_order_id: orderId, paymentUrl: r.paymentUrl, amount: money(amount) }
  }

  private async order(data?: Record<string, unknown>): Promise<YandexOrder> {
    this.ensureConfigured()
    const id = data?.yandex_order_id
    if (!id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Сплит: нет номера заказа Яндекс Пэй")
    const r = await yandexPayCall<{ order: YandexOrder }>(this.cfg, "GET", `/v1/orders/${encodeURIComponent(String(id))}`)
    return r.order
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const amount = new BigNumber(input.amount).numeric
    const data = await this.create(amount, (input.data ?? {}) as SessionInput, 1)
    return { id: data.yandex_order_id, data, status: "pending" }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const amount = new BigNumber(input.amount).numeric
    const prev = (input.data ?? {}) as SessionInput & { amount?: string; paymentUrl?: string; attempt?: number }
    if (prev.amount === money(amount) && prev.paymentUrl) return { data: input.data, status: "pending" }
    const data = await this.create(amount, prev, (prev.attempt ?? 1) + 1)
    return { data, status: "pending" }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const o = await this.order(input.data)
    return { status: toSessionStatus(o.paymentStatus), data: { ...input.data, paymentStatus: o.paymentStatus } }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const o = await this.order(input.data)
    // Двухстадийный режим: подтверждаем списание; одностадийный — уже CAPTURED
    if (o.paymentStatus === "AUTHORIZED") {
      await yandexPayCall(this.cfg, "POST", `/v1/orders/${encodeURIComponent(o.orderId)}/capture`, {}, `capture-${o.orderId}`)
      return { data: { ...input.data, paymentStatus: "CAPTURED" } }
    }
    return { data: { ...input.data, paymentStatus: o.paymentStatus } }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    this.ensureConfigured()
    const amount = new BigNumber(input.amount).numeric
    const id = String(input.data?.yandex_order_id)
    try {
      await yandexPayCall(this.cfg, "POST", `/v2/orders/${encodeURIComponent(id)}/refund`, { refundAmount: money(amount) }, `refund-${id}-${money(amount)}`)
    } catch (e) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED,
        `Сплит: возврат не прошёл (${(e as Error).message}). Частичный возврат по Сплиту оформите в личном кабинете Яндекс Пэй.`)
    }
    return { data: { ...input.data, refunded: money(amount) } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    if (!input.data?.yandex_order_id || !this.cfg.apiKey) return { data: input.data }
    try {
      const o = await this.order(input.data)
      if (o.paymentStatus === "AUTHORIZED") {
        await yandexPayCall(this.cfg, "POST", `/v1/orders/${encodeURIComponent(o.orderId)}/cancel`, { reason: "Заказ отменён" }, `cancel-${o.orderId}`)
      }
    } catch (e) {
      this.logger.warn(`Сплит: отмена ${input.data.yandex_order_id} не удалась: ${(e as Error).message}`)
    }
    return { data: input.data }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const o = await this.order(input.data)
    return { status: toSessionStatus(o.paymentStatus), data: { ...input.data, paymentStatus: o.paymentStatus } }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const o = await this.order(input.data)
    return { data: { ...input.data, paymentStatus: o.paymentStatus } }
  }

  /**
   * Уведомление Яндекс Пэй (маршрут /hooks/yandex-split/v1/webhook передаёт сюда orderId).
   * Подписи не доверяем: статус и сумму берём запросом заказа по нашему ключу.
   */
  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    const orderId = String((payload.data as { orderId?: string } | undefined)?.orderId ?? "")
    if (!orderId || !this.cfg.apiKey) return { action: PaymentActions.NOT_SUPPORTED }
    const o = await this.order({ yandex_order_id: orderId })
    const data = { session_id: sessionIdOf(o.orderId), amount: new BigNumber(Number(o.orderAmount ?? 0)) }
    switch (o.paymentStatus) {
      case "CAPTURED":
      case "CONFIRMED":
        return { action: PaymentActions.SUCCESSFUL, data }
      case "AUTHORIZED":
        return { action: PaymentActions.AUTHORIZED, data }
      case "FAILED":
        return { action: PaymentActions.FAILED, data }
      case "VOIDED":
        return { action: PaymentActions.CANCELED, data }
      default:
        return { action: PaymentActions.NOT_SUPPORTED }
    }
  }
}

export default YandexSplitPaymentProviderService
