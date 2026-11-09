import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { listSubscribers } from "../../../lib/newsletter/newsletter"

/** Подписчики: список (JSON) или выгрузка в CSV (?format=csv) — для сервиса рассылок. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const subs = await listSubscribers(req.scope)
  // Какие промокоды уже использованы
  const codes = subs.map((s) => s.promo_code).filter(Boolean) as string[]
  const used = new Set<string>()
  if (codes.length) {
    const promos = (await req.scope.resolve(Modules.PROMOTION).listPromotions({ code: codes }, { take: codes.length, select: ["code", "used"] })) as unknown as { code: string; used: number }[]
    for (const p of promos) if (Number(p.used) > 0) used.add(p.code)
  }
  const rows = subs.map((s) => ({ email: s.email, created_at: s.created_at, promo_code: s.promo_code, promo_used: s.promo_code ? used.has(s.promo_code) : false, unsubscribed: !!s.unsubscribed_at }))
  if (req.query.format === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
    const csv = ["email;дата подписки;промокод;промокод использован;отписался", ...rows.map((r) => [r.email, new Date(r.created_at).toLocaleString("ru-RU"), r.promo_code, r.promo_used ? "да" : "нет", r.unsubscribed ? "да" : "нет"].map(esc).join(";"))].join("\r\n")
    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="subscribers.csv"`)
    res.send("﻿" + csv)
    return
  }
  res.json({ subscribers: rows, total: rows.length, active: rows.filter((r) => !r.unsubscribed).length })
}
