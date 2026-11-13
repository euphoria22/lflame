/**
 * Подарочные карты: правила без обращения к базе (проверяются тестами).
 * Код — LF-XXXX-XXXX-XXXX из букв и цифр без похожих (0/O, 1/I/L), хранится без дефисов.
 */
import { randomInt } from "crypto"

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

/** Новый код: 12 случайных знаков (~59 бит) — подобрать нельзя */
export function newCode(): string {
  let s = "LF"
  for (let i = 0; i < 12; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return s
}

/** Русские буквы, похожие на латинские (набрали в русской раскладке) */
const CYR: Record<string, string> = { А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", Р: "P", С: "C", Т: "T", Х: "X", У: "Y" }

/** Как ввёл покупатель (с дефисами, пробелами, строчными, русскими «похожими» буквами) → как хранится */
export function normalizeCode(input: string): string {
  return String(input ?? "").toUpperCase().replace(/[\s\-–—_.]/g, "").replace(/[АВЕКМНРСТХУ]/g, (c) => CYR[c] ?? c)
}

/** Для показа: LF-ABCD-2345-XYZW */
export function formatCode(code: string): string {
  const c = normalizeCode(code)
  return c.length === 14 ? `${c.slice(0, 2)}-${c.slice(2, 6)}-${c.slice(6, 10)}-${c.slice(10)}` : c
}

/** Похоже на код карты (чтобы не ходить в базу с мусором) */
export const looksLikeCode = (input: string) => /^LF[A-Z0-9]{12}$/.test(normalizeCode(input))

export type GiftCardSettings = {
  enabled: boolean
  /** Готовые номиналы, ₽ */
  amounts: number[]
  /** Своя сумма: от — до, ₽ */
  min: number
  max: number
  /** Срок действия, месяцев */
  validity_months: number
}

export const DEFAULT_GIFT_SETTINGS: GiftCardSettings = {
  enabled: true,
  amounts: [3000, 5000, 10000, 15000, 20000],
  min: 1000,
  max: 100000,
  validity_months: 12,
}

export function validateGiftSettings(input: Partial<GiftCardSettings>): { value?: GiftCardSettings; error?: string } {
  const v = { ...DEFAULT_GIFT_SETTINGS, ...input }
  const amounts = [...new Set((Array.isArray(v.amounts) ? v.amounts : []).map((n) => Math.round(Number(n))).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b)
  const min = Math.round(Number(v.min))
  const max = Math.round(Number(v.max))
  const months = Math.round(Number(v.validity_months))
  if (!amounts.length) return { error: "Укажите хотя бы один номинал" }
  if (!(min >= 100 && max <= 500000 && min <= max)) return { error: "Своя сумма: от 100 до 500 000 ₽, «от» не больше «до»" }
  if (amounts.some((a) => a < 100 || a > 500000)) return { error: "Номиналы — от 100 до 500 000 ₽" }
  if (!(months >= 1 && months <= 60)) return { error: "Срок действия — от 1 до 60 месяцев" }
  return { value: { enabled: Boolean(v.enabled), amounts, min, max, validity_months: months } }
}

/** Сумма покупки допустима: готовый номинал или своя в пределах */
export function amountAllowed(amount: number, s: GiftCardSettings): boolean {
  return Number.isInteger(amount) && (s.amounts.includes(amount) || (amount >= s.min && amount <= s.max))
}

/** Срок: через months месяцев, до конца того же дня по Омску (UTC+6) — дата в письме, на сайте и в админке совпадает */
export function expiresAt(from: Date, months: number): Date {
  const omsk = new Date(from.getTime() + 6 * 3_600_000)
  const day = Math.min(omsk.getUTCDate(), new Date(Date.UTC(omsk.getUTCFullYear(), omsk.getUTCMonth() + months + 1, 0)).getUTCDate())
  return new Date(Date.UTC(omsk.getUTCFullYear(), omsk.getUTCMonth() + months, day, 23, 59, 59) - 6 * 3_600_000)
}

export type CardState = { status: string; balance: number; expires_at: Date | string | null }

/** Можно ли платить картой сейчас; причина — человеческим языком */
export function usable(card: CardState | null | undefined, now = new Date()): { ok: true } | { ok: false; reason: string } {
  if (!card || card.status === "pending") return { ok: false, reason: "Карта не найдена — проверьте код" }
  if (card.status === "disabled") return { ok: false, reason: "Карта отключена — напишите нам, разберёмся" }
  if (card.expires_at && new Date(card.expires_at).getTime() < now.getTime()) return { ok: false, reason: "Срок действия карты истёк" }
  if (!(card.balance > 0)) return { ok: false, reason: "На карте не осталось средств" }
  return { ok: true }
}

/** Сколько списать с карты за заказ: не больше остатка и не больше суммы к оплате */
export const applicable = (balance: number, total: number) => Math.max(0, Math.min(Math.floor(balance), Math.ceil(total)))
