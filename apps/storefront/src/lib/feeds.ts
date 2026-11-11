import "server-only"

import { getCatalog } from "./catalog"
import { routes } from "./routes"
import { SITE_NAME, SITE_URL } from "./site"
import type { CatalogItem } from "./types"

/**
 * Товарные фиды: Яндекс (YML — «Товары» в поиске Яндекса, Яндекс Бизнес) и Google (Merchant Center).
 * Одно предложение на размер в наличии, размеры одной модели связаны group_id / item_group_id.
 * Строятся из закэшированного каталога; цены и наличие — те же, что на сайте.
 */
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")

const GENDER_RU: Record<string, string> = { men: "Мужской", women: "Женский", unisex: "Унисекс" }
const GENDER_G: Record<string, string> = { men: "male", women: "female", unisex: "unisex" }

/** Числовой group_id (Яндекс требует цифры, не длиннее 9 знаков) — стабильный по адресу товара. */
function groupId(handle: string): number {
  let h = 0
  for (const ch of handle) h = (h * 31 + ch.charCodeAt(0)) % 999_999_937
  return h + 1
}

const url = (i: CatalogItem) => `${SITE_URL}${routes.product(i.handle)}`
const pictures = (i: CatalogItem) => [i.thumbnail, i.hover_image].filter((x): x is string => Boolean(x))
const describe = (i: CatalogItem) =>
  `${i.title}. Оригинальный товар${i.brand ? ` бренда ${i.brand.name}` : ""}${i.color_name ? `, цвет: ${i.color_name.toLowerCase()}` : ""}. Доставка по России, обмен и возврат.`

/** Размеры в наличии; у товара без размеров — одно предложение. */
function offers(i: CatalogItem) {
  const sizes = i.sizes.filter((s) => s.in_stock)
  return sizes.length ? sizes.map((s) => ({ id: s.variant_id ?? `${i.handle}-${s.size}`, size: s.size })) : [{ id: i.handle, size: null as string | null }]
}

function forSale(items: CatalogItem[]) {
  return items.filter((i) => i.in_stock && i.price > 0 && i.thumbnail)
}

export async function yandexFeed(): Promise<string> {
  const items = forSale(await getCatalog())
  const cats = new Map<string, { id: number; name: string }>()
  for (const i of items) if (i.category && !cats.has(i.category.handle)) cats.set(i.category.handle, { id: cats.size + 1, name: i.category.name })
  const date = new Date().toISOString().slice(0, 16).replace("T", " ")
  const out: string[] = []
  for (const i of items) {
    const cat = i.category ? cats.get(i.category.handle) : undefined
    for (const o of offers(i)) {
      out.push(`<offer id="${esc(o.id)}" group_id="${groupId(i.handle)}" available="true">
<url>${esc(url(i))}</url>
<price>${i.price}</price>${i.compare_at && i.compare_at > i.price ? `\n<oldprice>${i.compare_at}</oldprice>` : ""}
<currencyId>RUB</currencyId>${cat ? `\n<categoryId>${cat.id}</categoryId>` : ""}
${pictures(i).map((p) => `<picture>${esc(p)}</picture>`).join("\n")}
<delivery>true</delivery>
<pickup>true</pickup>
<name>${esc(i.title)}</name>${i.brand ? `\n<vendor>${esc(i.brand.name)}</vendor>` : ""}
<description>${esc(describe(i))}</description>
${i.outlet ? `<condition type="reduction"><reason>${esc(i.outlet_note || "Небольшой дефект")}</reason></condition>` : ""}${o.size ? `\n<param name="Размер">${esc(o.size)}</param>` : ""}${i.color_name ? `\n<param name="Цвет">${esc(i.color_name)}</param>` : ""}
<param name="Пол">${esc(GENDER_RU[i.gender] ?? "Унисекс")}</param>
</offer>`)
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="${date}">
<shop>
<name>${esc(SITE_NAME)}</name>
<company>ИП Парфенов Алексей Дмитриевич</company>
<url>${esc(SITE_URL)}</url>
<currencies><currency id="RUB" rate="1"/></currencies>
<categories>
${[...cats.values()].map((c) => `<category id="${c.id}">${esc(c.name)}</category>`).join("\n")}
</categories>
<offers>
${out.join("\n")}
</offers>
</shop>
</yml_catalog>
`
}

export async function googleFeed(): Promise<string> {
  const items = forSale(await getCatalog())
  const out: string[] = []
  for (const i of items) {
    const [main, ...rest] = pictures(i)
    for (const o of offers(i)) {
      const sale = i.compare_at && i.compare_at > i.price
      out.push(`<item>
<g:id>${esc(o.id)}</g:id>
<g:item_group_id>${groupId(i.handle)}</g:item_group_id>
<title>${esc(i.title)}</title>
<description>${esc(describe(i))}</description>
<link>${esc(url(i))}</link>
<g:image_link>${esc(main)}</g:image_link>${rest.map((p) => `\n<g:additional_image_link>${esc(p)}</g:additional_image_link>`).join("")}
<g:availability>in_stock</g:availability>
<g:price>${(sale ? i.compare_at! : i.price).toFixed(2)} RUB</g:price>${sale ? `\n<g:sale_price>${i.price.toFixed(2)} RUB</g:sale_price>` : ""}${i.brand ? `\n<g:brand>${esc(i.brand.name)}</g:brand>` : ""}
<g:condition>new</g:condition>
<g:identifier_exists>no</g:identifier_exists>
<g:age_group>adult</g:age_group>
<g:gender>${GENDER_G[i.gender] ?? "unisex"}</g:gender>${i.color_name ? `\n<g:color>${esc(i.color_name)}</g:color>` : ""}${o.size ? `\n<g:size>${esc(o.size)}</g:size>` : ""}${i.category ? `\n<g:product_type>${esc(i.category.name)}</g:product_type>` : ""}
</item>`)
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${esc(SITE_NAME)}</title>
<link>${esc(SITE_URL)}</link>
<description>Оригинальная одежда, обувь и аксессуары</description>
${out.join("\n")}
</channel>
</rss>
`
}
