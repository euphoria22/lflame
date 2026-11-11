import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BrandPatch, updateBrandRow } from "../../../../lib/brands/admin"

const LIMITS: Record<string, number> = { name: 100, short_description: 500, description: 5000, seo_title: 120, seo_description: 300, seo_text: 10000 }

/** Изменить бренд: название, тексты, видимость на сайте, другие написания. */
export async function POST(req: MedusaRequest<BrandPatch>, res: MedusaResponse) {
  const b = req.body ?? {}
  const patch: BrandPatch = {}
  for (const k of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    const v = (b as Record<string, unknown>)[k]
    if (v === undefined) continue
    if (v !== null && typeof v !== "string") { res.status(400).json({ message: `Поле ${k}: ожидается текст` }); return }
    if (typeof v === "string" && v.length > LIMITS[k]) { res.status(400).json({ message: `Поле ${k}: не длиннее ${LIMITS[k]} символов` }); return }
    ;(patch as Record<string, unknown>)[k] = v
  }
  if (typeof b.is_active === "boolean") patch.is_active = b.is_active
  if (Array.isArray(b.aliases)) patch.aliases = b.aliases.filter((a): a is string => typeof a === "string").map((a) => a.slice(0, 100)).slice(0, 50)
  await updateBrandRow(req.scope, req.params.id, patch)
  res.json({ ok: true })
}
