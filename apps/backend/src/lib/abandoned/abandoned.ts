import { createHmac, timingSafeEqual } from "node:crypto"
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { variantStock } from "../catalog/store-catalog"
import { createWelcomePromo, isUnsubscribed, unsubscribeUrl } from "../newsletter/newsletter"
import { sendMail } from "../notify/mailer"
import { abandonedCartMail, AbandonedItem, site } from "../notify/templates"
import { getShopSettings } from "../settings/shop-settings"

/**
 * Письмо о брошенной корзине. Раз в 15 минут ищем корзины:
 *  - есть почта (покупатель ввёл её при оформлении или вошёл в кабинет) и товары;
 *  - не оформлены и не менялись delay_hours часов (но не старше 3 суток — потом напоминать поздно);
 *  - письмо по этой корзине ещё не отправляли; по этому адресу с тех пор не было заказа;
 *  - адрес не отписан; если включено «только с согласием» — покупатель отметил «Хочу получать новости».
 * В письме — только товары, которые ещё есть в наличии (нет ни одного — не пишем).
 * Кнопка «Вернуться к корзине» открывает ту же корзину на любом устройстве (ссылка с подписью) и применяет промокод.
 */
type Logger = { info: (m: string) => void; warn: (m: string) => void }
type Candidate = { id: string; email: string; created_at: Date; metadata: Record<string, unknown> | null }
type Line = { title?: string; product_title?: string | null; variant_title?: string | null; quantity: number; unit_price: number; variant_id?: string | null; product_handle?: string | null; thumbnail?: string | null }

const MAX_AGE_HOURS = 72
const BATCH = 50

/** Подпись ссылки восстановления: по номеру корзины без подписи чужую корзину не открыть */
export function restoreToken(cartId: string): string {
  return createHmac("sha256", `${process.env.COOKIE_SECRET ?? ""}:cart-restore`).update(cartId).digest("hex").slice(0, 32)
}
export const restoreUrl = (cartId: string) => `${site()}/cart/restore?c=${encodeURIComponent(cartId)}&t=${restoreToken(cartId)}`

export function checkRestoreToken(cartId: string, token: string): boolean {
  const a = Buffer.from(restoreToken(cartId)), b = Buffer.from(String(token))
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Пометка в metadata корзины без изменения updated_at (иначе корзина снова станет «свежей») */
async function markCart(container: MedusaContainer, id: string, patch: Record<string, unknown>) {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await pg.raw(`update cart set metadata = coalesce(metadata, '{}'::jsonb) || ?::jsonb where id = ?`, [JSON.stringify(patch), id])
}

export async function abandonedTick(container: MedusaContainer, log: Logger, now = new Date()): Promise<{ sent: number; skipped: number }> {
  const s = (await getShopSettings()).abandoned_cart
  if (!s.enabled) return { sent: 0, skipped: 0 }
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const until = new Date(now.getTime() - s.delay_hours * 3_600_000)
  const since = new Date(now.getTime() - MAX_AGE_HOURS * 3_600_000)
  const rows = (await pg.raw(
    `select c.id, lower(coalesce(nullif(c.email, ''), cu.email)) as email, c.created_at, c.metadata
     from cart c left join customer cu on cu.id = c.customer_id and cu.deleted_at is null
     where c.deleted_at is null and c.completed_at is null
       and c.updated_at <= ? and c.updated_at >= ?
       and (c.metadata->>'abandoned_sent_at') is null
       and coalesce(nullif(c.email, ''), cu.email) is not null
       and exists (select 1 from cart_line_item i where i.cart_id = c.id and i.deleted_at is null)
     order by c.updated_at desc limit ?`,
    [until, since, BATCH]
  )).rows as Candidate[]

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  let sent = 0, skipped = 0
  const seen = new Set<string>()
  for (const c of rows) {
    const skip = async (why: string) => { skipped++; await markCart(container, c.id, { abandoned_sent_at: now.toISOString(), abandoned_skipped: why }) }
    // Одно письмо на адрес за проход (несколько брошенных корзин одного покупателя)
    if (seen.has(c.email)) { await skip("duplicate"); continue }
    seen.add(c.email)
    if (s.consent_only && c.metadata?.marketing_consent !== true) { await skip("no_consent"); continue }
    if (await isUnsubscribed(container, c.email)) { await skip("unsubscribed"); continue }
    const ordered = (await pg.raw(`select 1 from "order" where lower(email) = ? and created_at >= ? and deleted_at is null limit 1`, [c.email, c.created_at])).rows.length
    if (ordered) { await skip("ordered"); continue }

    const { data } = await query.graph({
      entity: "cart",
      fields: ["id", "items.title", "items.product_title", "items.variant_title", "items.quantity", "items.unit_price", "items.variant_id", "items.product_handle", "items.thumbnail"],
      filters: { id: c.id },
    })
    const lines = ((data[0] as { items?: Line[] } | undefined)?.items ?? []).filter((l) => l.variant_id)
    const stock = await variantStock(container, lines.map((l) => l.variant_id!))
    const items: AbandonedItem[] = lines
      .filter((l) => (stock.get(l.variant_id!) ?? 0) > 0)
      .map((l) => ({
        title: l.product_title ?? l.title ?? "", variant: l.variant_title ?? "", quantity: Number(l.quantity) || 1, price: Number(l.unit_price) || 0,
        image: l.thumbnail ?? null, url: l.product_handle ? `${site()}/product/${l.product_handle}` : site(),
      }))
    if (!items.length) { await skip("out_of_stock"); continue }

    try {
      const code = s.discount_pct > 0 ? await createWelcomePromo(container, s.discount_pct, "BACK") : null
      await sendMail(abandonedCartMail(c.email, { items, restoreUrl: restoreUrl(c.id), code, pct: s.discount_pct, unsubscribeUrl: unsubscribeUrl(c.email) }), log)
      await markCart(container, c.id, { abandoned_sent_at: now.toISOString(), ...(code ? { abandoned_code: code } : {}) })
      sent++
    } catch (e) {
      log.warn(`Брошенная корзина: письмо ${c.email} не отправлено — ${(e as Error).message}`)
    }
  }
  if (sent) log.info(`Брошенные корзины: отправлено писем ${sent}`)
  return { sent, skipped }
}

/** Возврат по ссылке из письма: проверка подписи, отметка «вернулся», промокод для применения */
export async function restoreCart(container: MedusaContainer, cartId: string, token: string): Promise<{ ok: boolean; code: string | null; completed: boolean }> {
  if (!checkRestoreToken(cartId, token)) return { ok: false, code: null, completed: false }
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const row = (await pg.raw(`select completed_at, metadata from cart where id = ? and deleted_at is null`, [cartId])).rows[0] as { completed_at: Date | null; metadata: Record<string, unknown> | null } | undefined
  if (!row) return { ok: false, code: null, completed: false }
  if (!row.metadata?.abandoned_clicked_at) await markCart(container, cartId, { abandoned_clicked_at: new Date().toISOString() })
  return { ok: true, code: typeof row.metadata?.abandoned_code === "string" ? row.metadata.abandoned_code : null, completed: Boolean(row.completed_at) }
}

/** Статистика за 30 дней: отправлено, вернулись по ссылке, оформили заказ */
export async function abandonedStats(container: MedusaContainer): Promise<{ sent: number; clicked: number; recovered: number; revenue: number }> {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const r = (await pg.raw(
    `select count(*)::int as sent,
       count(*) filter (where c.metadata->>'abandoned_clicked_at' is not null)::int as clicked,
       count(*) filter (where c.completed_at is not null)::int as recovered
     from cart c where c.metadata->>'abandoned_sent_at' is not null and c.metadata->>'abandoned_skipped' is null
       and (c.metadata->>'abandoned_sent_at')::timestamptz > now() - interval '30 days'`
  )).rows[0] as { sent: number; clicked: number; recovered: number }
  const rev = (await pg.raw(
    `select coalesce(sum(o.total_amount), 0)::float as revenue from (
       select (select sum((s.totals->>'current_order_total')::numeric) from order_summary s where s.order_id = oc.order_id and s.deleted_at is null) as total_amount
       from cart c join order_cart oc on oc.cart_id = c.id
       where c.metadata->>'abandoned_sent_at' is not null and c.metadata->>'abandoned_skipped' is null and c.completed_at is not null
         and (c.metadata->>'abandoned_sent_at')::timestamptz > now() - interval '30 days') o`
  ).catch(() => ({ rows: [{ revenue: 0 }] }))).rows[0] as { revenue: number }
  return { ...r, revenue: Math.round(rev.revenue ?? 0) }
}
