import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

type Label = { tracking_number?: string; tracking_url?: string; label_url?: string }

/** Ссылка на отслеживание по номеру: Почта России (14 цифр или RA123456789RU) или СДЭК. */
export function trackingUrl(num: string): string {
  const n = num.replace(/\s+/g, "").toUpperCase()
  return /^\d{14}$/.test(n) || /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(n)
    ? `https://www.pochta.ru/tracking?barcode=${encodeURIComponent(n)}`
    : `https://www.cdek.ru/ru/tracking/?order_id=${encodeURIComponent(n)}`
}

/** Пустые строки формы убираем, ссылки по номеру подставляем сами. */
export function cleanLabels(labels: Label[]): Required<Label>[] {
  return labels
    .map((l) => ({ num: (l.tracking_number ?? "").trim(), url: (l.tracking_url ?? "").trim(), label: (l.label_url ?? "").trim() }))
    .filter((l) => l.num || l.url)
    .map((l) => {
      const url = l.url || (l.num ? trackingUrl(l.num) : "")
      return { tracking_number: l.num || "—", tracking_url: url, label_url: l.label || url }
    })
}

/**
 * «Отметить отправленным» в админке Medusa требует заполнить строку трек-номера целиком
 * (ссылку на отслеживание и на этикетку), а пустая строка даёт ошибку «URL must use http: or https: scheme».
 * Здесь, до проверки Medusa: пустые строки удаляются (отправка без трек-номера — можно),
 * а по одному номеру ссылки на отслеживание и «этикетку» подставляются сами.
 */
export function shipmentLabelsMiddleware(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  const path = (req.originalUrl ?? req.url ?? "").split("?")[0]
  const body = req.body as { labels?: Label[] } | undefined
  if (req.method === "POST" && /\/admin\/orders\/[^/]+\/fulfillments\/[^/]+\/shipments$/.test(path) && Array.isArray(body?.labels)) {
    body!.labels = cleanLabels(body!.labels)
  }
  next()
}
