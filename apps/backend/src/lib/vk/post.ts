import { arrival, inStockSizes, PostProduct } from "../telegram/post"

/**
 * Текст поста во ВКонтакте. Разметки (жирного) ВКонтакте не поддерживает — только текст:
 * те же строки, что в Telegram, цены и «SALE» выделены переносами. Ссылка на товар — в тексте.
 */
const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU").replace(/\s/g, " ")} ₽`
const strike = (s: string) => [...s].map((c) => `${c}̶`).join("")
const stripHtml = (s: string) => s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()

/** Длина текста: у ВКонтакте лимит 16 000 знаков, но пост в ленте лучше держать коротким */
export const VK_TEXT_LIMIT = 2000

function about(p: PostProduct): string {
  const text: string[] = []
  const specs: string[] = []
  for (const line of (p.specs ?? "").split("\n").map((l) => l.trim()).filter(Boolean)) {
    const m = /^([^:]{1,40}):\s*(.+)$/.exec(line)
    if (m) specs.push(`${m[1].trim()}: ${m[2].trim()}`)
    else if (/\d\s*%/.test(line)) specs.push(`Состав: ${line}`)
    else text.push(line)
  }
  const description = p.description ? stripHtml(p.description) : text.join("\n")
  return [description, specs.join("\n")].filter(Boolean).join("\n\n")
}

export function buildVkText(p: PostProduct, opts: { site: string; contact: string }): string {
  const url = `${opts.site}/product/${p.handle}`
  const sizes = inStockSizes(p)
  const final = p.promo?.price ?? p.price
  const was = p.compare_at && p.compare_at > final ? p.compare_at : p.promo ? p.price : null
  const head = [
    p.title,
    "",
    was ? `${rub(final)}  ${strike(rub(was))}${p.promo && !p.preorder ? " — SALE 🔥" : ""}` : rub(final),
    p.promo ? `Дополнительная скидка −${p.promo.pct}% по акции «${p.promo.label}» уже в цене` : null,
    ...(p.preorder ? ["", `🕓 Предзаказ — ${arrival(p.preorder_date) ? `ориентировочная дата поступления до ${arrival(p.preorder_date)}` : "товар уже едет к нам"}`] : []),
    p.outlet ? "Outlet: вещь с небольшим дефектом, поэтому дешевле" : null,
    "",
    sizes.length ? `${p.preorder ? "Размеры для предзаказа" : "Размеры в наличии"}: ${sizes.join(", ")}` : p.preorder ? null : "Нет в наличии",
  ].filter((l): l is string => l !== null)
  const foot = [`Купить на сайте: ${url}`, `Оформить заказ: ${opts.contact}`]
  const fixed = [...head, "", ...foot].join("\n").length + 4
  let text = about(p)
  const room = VK_TEXT_LIMIT - fixed
  if (text.length > room) text = room > 40 ? `${text.slice(0, room - 1).replace(/\s+\S*$/, "")}…` : ""
  return [...head, ...(text ? ["", text] : []), "", ...foot].join("\n").replace(/\n{3,}/g, "\n\n")
}
