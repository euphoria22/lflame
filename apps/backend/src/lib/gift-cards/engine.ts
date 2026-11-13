import { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { GIFT_CARD_MODULE } from "../../modules/gift-card"
import GiftCardModuleService from "../../modules/gift-card/service"
import { sendMail } from "../notify/mailer"
import { esc, sendTelegram } from "../notify/telegram"
import { rub, site } from "../notify/templates"
import { kopecks, TbankConfig, tbankCall } from "../payments/tbank-client"
import { getShopSettings } from "../settings/shop-settings"
import { giftCardBuyerMail, giftCardMail } from "./mails"
import { amountAllowed, applicable, expiresAt, formatCode, looksLikeCode, newCode, normalizeCode, usable } from "./rules"

/**
 * Подарочные карты: покупка через Т-Кассу, активация по уведомлению, письма (сразу или в выбранный день),
 * списание на сайте (кредитная строка заказа) и в шоуруме (из админки), возврат при отмене заказа.
 * Все изменения баланса — через журнал операций (gift_card_transaction).
 */

export type GiftCard = {
  id: string; code: string; amount: number; balance: number; status: "pending" | "active" | "disabled"
  expires_at: Date | null; buyer_name: string | null; buyer_email: string | null; buyer_phone: string | null
  recipient_name: string | null; recipient_email: string | null; message: string | null
  send_at: Date | null; sent_at: Date | null; source: "site" | "admin"; payment_id: string | null; paid_at: Date | null; note: string | null
  created_at: Date
}
export type TxKind = "issue" | "redeem_online" | "redeem_store" | "refund" | "adjust"
type Tx = { id: string; gift_card_id: string; amount: number; kind: TxKind; reference: string | null; note: string | null; created_by: string | null; created_at: Date }

const svc = (c: MedusaContainer) => c.resolve<GiftCardModuleService>(GIFT_CARD_MODULE)
type Logger = { info: (m: string) => void; warn: (m: string) => void }

export async function giftSettings() {
  return (await getShopSettings()).gift_cards
}

export async function findByCode(c: MedusaContainer, input: string): Promise<GiftCard | null> {
  if (!looksLikeCode(input)) return null
  const [card] = (await svc(c).listGiftCards({ code: normalizeCode(input) })) as unknown as GiftCard[]
  return card ?? null
}

export async function getCard(c: MedusaContainer, id: string): Promise<GiftCard | null> {
  const [card] = (await svc(c).listGiftCards({ id })) as unknown as GiftCard[]
  return card ?? null
}

/** Изменения баланса одной карты — по очереди (иначе два списания могли бы прочитать один и тот же остаток) */
const locks = new Map<string, Promise<unknown>>()
function locked<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  locks.set(id, next.catch(() => null))
  return next
}

/**
 * Операция по карте: + пополнение, − списание. Списать больше остатка нельзя (allowPartial — списать сколько есть).
 * Возвращает фактическую сумму операции.
 */
export async function move(c: MedusaContainer, cardId: string, amount: number, op: { kind: Tx["kind"]; reference?: string | null; note?: string | null; by?: string | null; allowPartial?: boolean }): Promise<{ applied: number; balance: number }> {
  return locked(cardId, async () => {
    const card = await getCard(c, cardId)
    if (!card) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Карта не найдена")
    // Одна и та же операция по заказу не проводится дважды
    if (op.reference) {
      const [dup] = (await svc(c).listGiftCardTransactions({ gift_card_id: cardId, reference: op.reference, kind: op.kind })) as unknown as Tx[]
      if (dup) return { applied: 0, balance: card.balance }
    }
    let applied = Math.round(amount)
    if (applied < 0 && -applied > card.balance) {
      if (!op.allowPartial) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `На карте только ${rub(card.balance)}`)
      applied = -card.balance
    }
    if (applied === 0) return { applied: 0, balance: card.balance }
    const balance = card.balance + applied
    await svc(c).updateGiftCards({ id: card.id, balance })
    await svc(c).createGiftCardTransactions({ gift_card_id: card.id, amount: applied, kind: op.kind, reference: op.reference ?? null, note: op.note ?? null, created_by: op.by ?? "система" })
    return { applied, balance }
  })
}

export async function transactions(c: MedusaContainer, cardId: string): Promise<Tx[]> {
  return (await svc(c).listGiftCardTransactions({ gift_card_id: cardId }, { order: { created_at: "DESC" }, take: 500 })) as unknown as Tx[]
}

async function uniqueCode(c: MedusaContainer): Promise<string> {
  for (;;) {
    const code = newCode()
    const [dup] = await svc(c).listGiftCards({ code })
    if (!dup) return code
  }
}

export type PurchaseInput = {
  amount: number
  buyer: { name: string; email: string; phone?: string | null }
  /** Пусто — карта себе */
  recipient?: { name?: string | null; email: string } | null
  message?: string | null
  /** День отправки получателю (ГГГГ-ММ-ДД), пусто — сразу после оплаты */
  send_date?: string | null
}

const clean = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** День отправки → 10:00 по Омску этого дня (UTC+6) */
export function sendAtFor(day: string | null | undefined, now = new Date()): Date | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const at = new Date(`${day}T04:00:00Z`)
  if (Number.isNaN(at.getTime())) return null
  if (at.getTime() - now.getTime() > 366 * 86_400_000) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Дата отправки — не дальше чем через год")
  return at.getTime() <= now.getTime() ? null : at
}

function tbankConfig(): TbankConfig & { notificationUrl: string } {
  const terminalKey = process.env.TBANK_TERMINAL_KEY
  const password = process.env.TBANK_PASSWORD
  if (!terminalKey || !password) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Онлайн-оплата не настроена")
  const backend = (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/+$/, "")
  return {
    apiUrl: process.env.TBANK_API_URL || "https://securepay.tinkoff.ru/v2",
    terminalKey, password, taxation: process.env.TBANK_TAXATION || undefined,
    notificationUrl: `${backend}/hooks/gift-card/tbank`,
  }
}

/** Покупка на сайте: карта «ждёт оплаты» и ссылка на платёжную форму Т-Кассы */
export async function startPurchase(c: MedusaContainer, input: PurchaseInput): Promise<{ id: string; payment_url: string }> {
  const s = await giftSettings()
  if (!s.enabled) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Подарочные карты сейчас не продаются")
  const amount = Math.round(Number(input.amount))
  if (!amountAllowed(amount, s)) throw new MedusaError(MedusaError.Types.INVALID_DATA, `Сумма — от ${rub(s.min)} до ${rub(s.max)}`)
  const buyerEmail = clean(input.buyer?.email, 200).toLowerCase()
  if (!clean(input.buyer?.name, 100) || !EMAIL.test(buyerEmail)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Укажите ваше имя и email")
  const recipientEmail = input.recipient ? clean(input.recipient.email, 200).toLowerCase() : null
  if (input.recipient && !EMAIL.test(recipientEmail ?? "")) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Укажите email получателя")
  const cfg = tbankConfig()

  const card = (await svc(c).createGiftCards({
    code: await uniqueCode(c), amount, balance: 0, status: "pending",
    buyer_name: clean(input.buyer.name, 100), buyer_email: buyerEmail, buyer_phone: clean(input.buyer.phone, 30) || null,
    recipient_name: input.recipient ? clean(input.recipient.name, 100) || null : null,
    recipient_email: recipientEmail,
    message: clean(input.message, 500) || null,
    send_at: input.recipient ? sendAtFor(input.send_date) : null,
    source: "site",
  })) as unknown as GiftCard

  const name = `Подарочная карта Laflamme на ${rub(amount)}`
  const r = await tbankCall(cfg, "Init", {
    Amount: kopecks(amount),
    OrderId: card.id,
    Description: name,
    SuccessURL: `${site()}/gift-cards/thanks?id=${card.id}`,
    FailURL: `${site()}/gift-cards?payment=failed`,
    NotificationURL: cfg.notificationUrl,
    Language: "ru",
    DATA: { Email: buyerEmail },
    // Чек 54-ФЗ: продажа подарочной карты — аванс (товар покупатель выберет позже)
    ...(cfg.taxation ? {
      Receipt: {
        Email: buyerEmail, Taxation: cfg.taxation,
        Items: [{ Name: name, Price: kopecks(amount), Quantity: 1, Amount: kopecks(amount), Tax: "none", PaymentMethod: "advance", PaymentObject: "payment" }],
      },
    } : {}),
  })
  await svc(c).updateGiftCards({ id: card.id, payment_id: String(r.PaymentId) })
  if (!r.PaymentURL) throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Т-Касса не вернула ссылку на оплату")
  return { id: card.id, payment_url: r.PaymentURL }
}

/** Оплата прошла: карта действует, баланс = номинал, срок — с сегодняшнего дня. Повторный вызов ничего не делает. */
export async function activate(c: MedusaContainer, cardId: string, log: Logger, opts: { payment_id?: string; by?: string } = {}): Promise<GiftCard | null> {
  return locked(cardId, async () => {
    const card = await getCard(c, cardId)
    if (!card || card.status !== "pending") return card
    const s = await giftSettings()
    const now = new Date()
    await svc(c).updateGiftCards({ id: card.id, status: "active", balance: card.amount, paid_at: now, expires_at: expiresAt(now, s.validity_months), ...(opts.payment_id ? { payment_id: opts.payment_id } : {}) })
    await svc(c).createGiftCardTransactions({ gift_card_id: card.id, amount: card.amount, kind: "issue", reference: opts.payment_id ? `tbank:${opts.payment_id}` : "issue", note: card.source === "admin" ? card.note : "Покупка на сайте", created_by: opts.by ?? "система" })
    const fresh = (await getCard(c, card.id))!
    log.info(`Подарочная карта ${formatCode(fresh.code)} на ${rub(fresh.amount)} активирована`)
    await sendTelegram(
      `🎁 <b>Подарочная карта на ${rub(fresh.amount)}</b> ${fresh.source === "site" ? "оплачена на сайте" : "выпущена в админке"}\n`
      + `Покупатель: ${esc(fresh.buyer_name ?? "—")} ${esc(fresh.buyer_email ?? "")}\n`
      + (fresh.recipient_email ? `Получатель: ${esc(fresh.recipient_name ?? "")} ${esc(fresh.recipient_email)}${fresh.send_at ? `, письмо ${new Date(fresh.send_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Omsk" })}` : ""}` : "Для себя"),
      log,
    ).catch(() => null)
    // Покупателю подарка — подтверждение (сама карта уйдёт получателю сразу или в выбранный день)
    if (fresh.source === "site" && fresh.recipient_email && fresh.buyer_email) {
      await sendMail(giftCardBuyerMail(fresh.buyer_email, { ...fresh, recipient_email: fresh.recipient_email }), log).catch((e) => log.warn(`Подарочная карта: письмо покупателю не отправлено: ${(e as Error).message}`))
    }
    await sendDue(c, log).catch((e) => log.warn(`Подарочные карты: письма не отправлены: ${(e as Error).message}`))
    return fresh
  })
}

/** Письма с картами, которые пора отправить: сразу после оплаты или в выбранный день (задача раз в 10 минут) */
export async function sendDue(c: MedusaContainer, log: Logger): Promise<number> {
  const cards = (await svc(c).listGiftCards({ status: "active", sent_at: null }, { take: 500 })) as unknown as GiftCard[]
  let sent = 0
  for (const card of cards) {
    if (card.send_at && new Date(card.send_at).getTime() > Date.now()) continue
    const to = card.recipient_email || card.buyer_email
    if (!to) continue
    // Отмечаем заранее: письмо не уйдёт дважды, даже если две задачи запустятся одновременно
    await svc(c).updateGiftCards({ id: card.id, sent_at: new Date() })
    try {
      await sendMail(giftCardMail(to, card, !card.recipient_email), log)
      sent++
    } catch (e) {
      await svc(c).updateGiftCards({ id: card.id, sent_at: null })
      log.warn(`Подарочная карта ${card.id}: письмо не отправлено: ${(e as Error).message}`)
    }
  }
  return sent
}

/** Выпуск в админке (продали в шоуруме, подарок клиенту): сразу действует, письмо — если указан email */
export async function issueManual(c: MedusaContainer, input: { amount: number; email?: string | null; name?: string | null; message?: string | null; note?: string | null; by: string }, log: Logger): Promise<GiftCard> {
  const amount = Math.round(Number(input.amount))
  if (!(amount >= 100 && amount <= 500000)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Сумма — от 100 до 500 000 ₽")
  const email = clean(input.email, 200).toLowerCase() || null
  if (email && !EMAIL.test(email)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Неверный email")
  const card = (await svc(c).createGiftCards({
    code: await uniqueCode(c), amount, balance: 0, status: "pending", source: "admin",
    buyer_name: clean(input.name, 100) || null, buyer_email: email, message: clean(input.message, 500) || null,
    note: clean(input.note, 300) || null,
    // Без email письмо не отправляем — код выдадут вручную
    sent_at: email ? null : new Date(),
  })) as unknown as GiftCard
  return (await activate(c, card.id, log, { by: input.by }))!
}

/** Проверка карты для покупателя: баланс и срок, без личных данных */
export async function checkCard(c: MedusaContainer, code: string) {
  const card = await findByCode(c, code)
  const u = usable(card)
  return card && card.status !== "pending"
    ? { found: true, ok: u.ok, reason: u.ok ? null : u.reason, balance: card.balance, amount: card.amount, expires_at: card.expires_at }
    : { found: false, ok: false, reason: "Карта не найдена — проверьте код", balance: 0, amount: 0, expires_at: null }
}

export { applicable, usable }
