import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type Row = {
  id: string
  title: string
  status: string
  thumbnail?: string | null
  updated_at?: string
  metadata?: Record<string, unknown> | null
}

/**
 * Отчёт «товары с проблемами» (ТЗ, п. 2.3, 3.6): нет бренда, цвета, категории, фото, повтор размера.
 * Строится по товарам сайта: синхронизация записывает проблемы в metadata.problems,
 * поэтому отчёт актуален после любого запуска, полного или частичного.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const rows: Row[] = []
  const take = 1000
  for (let skip = 0; ; skip += take) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "status", "thumbnail", "updated_at", "metadata", "categories.id"],
      pagination: { take, skip },
    })
    for (const p of data as (Row & { categories?: { id: string }[] })[]) {
      if (!p.metadata?.moysklad_id || p.metadata?.discontinued) continue
      const problems = [...((p.metadata?.problems as string[] | undefined) ?? [])]
      if (!p.categories?.length && !problems.some((x) => x.startsWith("Нет категории"))) {
        problems.push("Нет категории")
      }
      if (!p.thumbnail) {
        problems.push("Нет фото, не опубликовано")
      }
      if (problems.length) {
        rows.push({ ...p, metadata: { moysklad_id: p.metadata.moysklad_id, problems } })
      }
    }
    if (data.length < take) break
  }

  const counts: Record<string, number> = {}
  for (const r of rows) {
    for (const p of r.metadata!.problems as string[]) {
      const key = p.replace(/\s*\(.*$/, "").replace(/[«:].*$/, "").trim()
      counts[key] = (counts[key] ?? 0) + 1
    }
  }

  res.json({
    checked_at: new Date().toISOString(),
    counts,
    items: rows.map((r) => ({
      id: r.id,
      moysklad_id: r.metadata!.moysklad_id as string,
      title: r.title,
      problems: r.metadata!.problems as string[],
    })),
  })
}
