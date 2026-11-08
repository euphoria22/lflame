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
  PaymentSessionStatus,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { buildReceipt, kopecks, ReceiptLine, TbankConfig, tbankCall, tbankVerify } from "../../lib/payments/tbank-client"

type Options = { terminalKey?: string; password?: string; apiUrl?: string; taxation?: string; notificationUrl?: string }

/** Данные, которые витрина передаёт при создании платёжной сессии. */
type SessionInput = {
  session_id?: string
  success_url?: string
  fail_url?: string
  description?: string
  email?: string
  phone?: string
  receipt?: ReceiptLine[]
}

const FINAL_OK = new Set(["CONFIRMED"])
const HELD = new Set(["AUTHORIZED"])
const FAILED = new Set(["REJECTED", "AUTH_FAIL", "DEADLINE_EXPIRED", "ATTEMPTS_EXPIRED"])
const CANCELED = new Set(["CANCELED", "REVERSED", "REFUNDED"])

function toSessionStatus(status?: string): PaymentSessionStatus {
  if (!status) return "pending"
  if (FINAL_OK.has(status)) return "captured"
  if (HELD.has(status)) return "authorized"
  if (FAILED.has(status)) return "error"
  if (CANCELED.has(status)) return "canceled"
  return "pending"
}

/**
 * Онлайн-оплата через Т-Кассу (ТЗ, п. 5.4): карта, СБП, T-Pay.
 * Покупатель уходит на платёжную форму Т-Банка (PaymentURL) и возвращается на витрину;
 * статус проверяется запросом GetState и приходит уведомлением на /hooks/payment/tbank_tbank.
 * OrderId в Т-Кассе = id платёжной сессии Medusa — по нему уведомление находит заказ.
 */
class TbankPaymentProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "tbank"

  protected logger: Logger
  protected cfg: TbankConfig & { notificationUrl?: string }

  constructor(container: { logger: Logger }, options: Options) {
    super(container, options)
    this.logger = container.logger
    this.cfg = {
      apiUrl: options.apiUrl || "https://securepay.tinkoff.ru/v2",
      terminalKey: options.terminalKey ?? "",
      password: options.password ?? "",
      taxation: options.taxation || undefined,
      notificationUrl: options.notificationUrl,
    }
  }

  static validateOptions(options: Options) {
    // Без ключей провайдер не ломает запуск: онлайн-оплата просто не предлагается на витрине
    if (options.terminalKey && !options.password) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Т-Касса: задан TBANK_TERMINAL_KEY, но нет TBANK_PASSWORD")
    }
  }

  private ensureConfigured() {
    if (!this.cfg.terminalKey || !this.cfg.password) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Онлайн-оплата не настроена (TBANK_TERMINAL_KEY / TBANK_PASSWORD)")
    }
  }

  private async init(amount: number, input: SessionInput) {
    this.ensureConfigured()
    if (!input.session_id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Т-Касса: нет id платёжной сессии")
    const lines = input.receipt ?? []
    const r = await tbankCall(this.cfg, "Init", {
      Amount: kopecks(amount),
      OrderId: input.session_id,
      Description: (input.description ?? "Заказ LAFLAMME").slice(0, 140),
      SuccessURL: input.success_url,
      FailURL: input.fail_url,
      NotificationURL: this.cfg.notificationUrl,
      Language: "ru",
      DATA: { Email: input.email, Phone: input.phone },
      ...(this.cfg.taxation && lines.length ? { Receipt: buildReceipt(lines, input, this.cfg.taxation) } : {}),
    })
    return {
      id: String(r.PaymentId),
      data: { ...input, receipt: undefined, PaymentId: String(r.PaymentId), PaymentURL: r.PaymentURL, Amount: r.Amount, Status: r.Status },
    }
  }

  private async state(data?: Record<string, unknown>) {
    this.ensureConfigured()
    const paymentId = data?.PaymentId
    if (!paymentId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Т-Касса: нет PaymentId")
    return tbankCall(this.cfg, "GetState", { PaymentId: String(paymentId) })
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const amount = new BigNumber(input.amount).numeric
    const r = await this.init(amount, (input.data ?? {}) as SessionInput)
    return { ...r, status: "pending" }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    // Сумму созданного платежа в Т-Кассе изменить нельзя — создаём новый
    const amount = new BigNumber(input.amount).numeric
    const prev = (input.data ?? {}) as SessionInput & { Amount?: number }
    if (prev.Amount === kopecks(amount) && (input.data as Record<string, unknown>)?.PaymentURL) return { data: input.data, status: "pending" }
    const r = await this.init(amount, prev)
    return { data: r.data, status: "pending" }
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const s = await this.state(input.data)
    return { status: toSessionStatus(s.Status), data: { ...input.data, Status: s.Status } }
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    const s = await this.state(input.data)
    // Двухстадийный терминал: подтверждаем списание. Одностадийный — уже CONFIRMED.
    if (s.Status === "AUTHORIZED") {
      const c = await tbankCall(this.cfg, "Confirm", { PaymentId: String(input.data?.PaymentId) })
      return { data: { ...input.data, Status: c.Status } }
    }
    return { data: { ...input.data, Status: s.Status } }
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    this.ensureConfigured()
    const amount = new BigNumber(input.amount).numeric
    const r = await tbankCall(this.cfg, "Cancel", { PaymentId: String(input.data?.PaymentId), Amount: kopecks(amount) })
    return { data: { ...input.data, Status: r.Status } }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    if (!input.data?.PaymentId || !this.cfg.terminalKey) return { data: input.data }
    try {
      const r = await tbankCall(this.cfg, "Cancel", { PaymentId: String(input.data.PaymentId) })
      return { data: { ...input.data, Status: r.Status } }
    } catch (e) {
      this.logger.warn(`Т-Касса: отмена платежа ${input.data.PaymentId} не удалась: ${(e as Error).message}`)
      return { data: input.data }
    }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const s = await this.state(input.data)
    return { status: toSessionStatus(s.Status), data: { ...input.data, Status: s.Status } }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const s = await this.state(input.data)
    return { data: { ...input.data, Status: s.Status } }
  }

  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    const n = (payload.data ?? {}) as Record<string, unknown>
    if (!this.cfg.password || !tbankVerify(n, this.cfg.password)) {
      this.logger.warn("Т-Касса: уведомление с неверной подписью отклонено")
      return { action: PaymentActions.NOT_SUPPORTED }
    }
    const data = { session_id: String(n.OrderId), amount: new BigNumber(Number(n.Amount ?? 0) / 100) }
    switch (n.Status) {
      case "CONFIRMED":
        return { action: PaymentActions.SUCCESSFUL, data }
      case "AUTHORIZED":
        return { action: PaymentActions.AUTHORIZED, data }
      case "REJECTED":
      case "AUTH_FAIL":
        return { action: PaymentActions.FAILED, data }
      case "CANCELED":
      case "DEADLINE_EXPIRED":
        return { action: PaymentActions.CANCELED, data }
      default:
        return { action: PaymentActions.NOT_SUPPORTED }
    }
  }
}

export default TbankPaymentProviderService
