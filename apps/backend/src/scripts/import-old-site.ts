import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow, uploadFilesWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Перенос описаний и фото со старого сайта (Битрикс, laflamme.ru) в товары нового.
 *
 *   npx medusa exec ./src/scripts/import-old-site.js          # пробный прогон: только отчёт, ничего не меняет
 *   npx medusa exec ./src/scripts/import-old-site.js apply    # записать описания и фото
 *   npx medusa exec ./src/scripts/import-old-site.js apply force  # и для уже перенесённых товаров
 *
 * Товар сопоставляется по названию (без учёта регистра, знаков и ё/е); запасной вариант — адрес страницы.
 * Если под название подходит несколько товаров — товар пропускается и попадает в отчёт.
 * Фото старого сайта заменяют фото товара на сайте (МойСклад не затрагивается), прежние файлы удаляются
 * из хранилища. Описание — блок «Характеристики» (состав, крой, детали). Адрес старого сайта: OLD_SITE_URL.
 */
const OLD_SITE = (process.env.OLD_SITE_URL || "https://laflamme.ru").replace(/\/+$/, "")
const MAX_IMAGES = 12

type Product = { id: string; title: string; handle: string; description: string | null; metadata: Record<string, unknown> | null; images?: { id: string; url: string }[] }
type OldPage = { url: string; title: string; description: string; images: string[] }

export function titleKey(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/g, "")
}
function slugKey(s: string): string {
  return s.toLowerCase().replace(/kh/g, "h").replace(/yeezy[-_]x[-_]gap/g, "yeezy-gap").replace(/[^a-z0-9]/g, "")
}
const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&quot;/g, "\"").replace(/&#0?39;|&apos;/g, "'").replace(/&laquo;/g, "«").replace(/&raquo;/g, "»")
    .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")

/** Разбор страницы товара старого сайта. */
export function parseOldPage(url: string, html: string): OldPage {
  const title = decode((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()
  // «Характеристики»: <spoiler-component id="FEATURETEXT"> … </template> <div class="pt-5">текст</div>
  let description = ""
  const at = html.indexOf('id="FEATURETEXT"')
  if (at >= 0) {
    const after = html.slice(html.indexOf("</template>", at) + "</template>".length)
    const body = after.match(/<div[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? ""
    description = decode(body.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, ""))
      .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).join("\n")
      .replace(/\n{3,}/g, "\n\n").trim()
  }
  // Галерея: <img … data-fancybox="gallery" data-src="/upload/iblock/…">
  const images: string[] = []
  for (const tag of html.match(/<img[^>]*data-fancybox="gallery"[^>]*>/g) ?? []) {
    const src = tag.match(/data-src="([^"]+)"/)?.[1] ?? tag.match(/\ssrc="(\/upload\/[^"]+)"/)?.[1]
    if (!src) continue
    const abs = src.startsWith("http") ? src : `${OLD_SITE}${src.startsWith("/") ? "" : "/"}${src}`
    if (!images.includes(abs)) images.push(abs)
  }
  return { url, title, description, images: images.slice(0, MAX_IMAGES) }
}

async function get(url: string, attempt = 1): Promise<Response> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { "user-agent": "LaflammeMigration/1.0" } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res
  } catch (e) {
    if (attempt < 3) return get(url, attempt + 1)
    throw new Error(`${url}: ${(e as Error).message}`)
  }
}

const MAX_LISTING_PAGES = 2500

/** Адрес на старом сайте без хоста и мусора: /catalog/…/ (+ только параметр листания PAGEN_N). */
function oldUrl(href: string): string | null {
  let u: URL
  try { u = new URL(href.replace(/&amp;/g, "&"), `${OLD_SITE}/`) } catch { return null }
  if (!u.pathname.startsWith("/catalog/")) return null
  const page = [...u.searchParams].find(([k]) => /^PAGEN_\d+$/.test(k))
  const path = u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`
  return `${OLD_SITE}${path}${page ? `?${page[0]}=${page[1]}` : ""}`
}

/**
 * Все товары старого сайта: карта сайта (в ней Битрикс показывает не всё) + обход разделов каталога
 * и страниц брендов с постраничной навигацией (?PAGEN_1=2…), пока появляются новые товары.
 */
async function productUrls(logger: { info: (m: string) => void }): Promise<string[]> {
  const products = new Set<string>()
  const listings = new Set<string>([`${OLD_SITE}/catalog/`])
  const addLink = (href: string) => {
    const u = oldUrl(href)
    if (!u) return
    if (u.includes("/product/")) products.add(u.replace(/\?.*$/, ""))
    else listings.add(u)
  }

  const index = await (await get(`${OLD_SITE}/sitemap.xml`)).text()
  const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  const xmls = index.includes("<sitemapindex") ? await Promise.all(locs(index).map(async (u) => (await get(oldUrl(u) ?? u.replace(/^https?:\/\/[^/]+/, OLD_SITE))).text().catch(() => ""))) : [index]
  xmls.flatMap(locs).forEach(addLink)
  const fromSitemap = products.size

  // Обход разделов: ссылки на товары, подразделы и страницы листания
  const visited = new Set<string>()
  while (visited.size < MAX_LISTING_PAGES) {
    const next = [...listings].filter((u) => !visited.has(u)).slice(0, 3)
    if (!next.length) break
    await Promise.all(next.map(async (url) => {
      visited.add(url)
      const before = products.size
      let html = ""
      try { html = await (await get(url)).text() } catch { return }
      for (const m of html.matchAll(/(?:href|data-href|data-url)="([^"]*\/catalog\/[^"]*)"/g)) addLink(m[1])
      // Листание без ссылок (кнопка «Показать ещё»): пробуем следующую страницу, пока она приносит новые товары
      if (products.size > before) {
        const u = new URL(url)
        const key = [...u.searchParams.keys()].find((k) => /^PAGEN_\d+$/.test(k)) ?? (html.match(/PAGEN_(\d+)=/)?.[0].slice(0, -1) || "PAGEN_1")
        const page = Number(u.searchParams.get(key) || "1")
        addLink(`${u.pathname}?${key}=${page + 1}`)
      }
    }))
  }
  logger.info(`Старый сайт: товаров в карте сайта ${fromSitemap}, всего после обхода каталога ${products.size} (просмотрено страниц разделов: ${visited.size})`)
  return [...products]
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]) }))
}

export default async function importOldSite({ container, args }: ExecArgs) {
  const apply = args.includes("apply")
  const force = args.includes("force")
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const files = container.resolve(Modules.FILE)

  const { data } = await query.graph({ entity: "product", fields: ["id", "title", "handle", "description", "metadata", "images.id", "images.url"], pagination: { take: 10000 } })
  const products = data as Product[]
  const byTitle = new Map<string, Product[]>()
  for (const p of products) byTitle.set(titleKey(p.title), [...(byTitle.get(titleKey(p.title)) ?? []), p])
  const bySlug = new Map(products.map((p) => [slugKey(p.handle), p]))

  logger.info(`Старый сайт: режим ${apply ? "ЗАПИСЬ" : "пробный (ничего не меняется)"}`)
  const urls = await productUrls(logger)

  const rows: string[] = ["статус;старый адрес;название на старом сайте;товар на новом сайте;символов описания;фото"]
  const stats = { matched: 0, by_url: 0, not_found: 0, ambiguous: 0, duplicates: 0, failed: 0, already: 0, updated: 0 }
  const used = new Set<string>()
  const fileBase = (process.env.S3_FILE_URL || `${(process.env.MEDUSA_BACKEND_URL || "").replace(/\/+$/, "")}/static`).replace(/\/+$/, "")

  // Не больше 3 страниц одновременно — бережём старый сайт на обычном хостинге
  await pool(urls, 3, async (url) => {
    let page: OldPage
    try {
      page = parseOldPage(url, await (await get(url)).text())
    } catch (e) {
      stats.failed++
      rows.push(`ошибка загрузки;${url};${(e as Error).message};;;`)
      return
    }
    // Нет названия — это не страница товара (ошибка, заглушка хостинга): пропускаем, не занимая товар
    if (!page.title) {
      stats.failed++
      rows.push(`не страница товара;${url};;;;`)
      return
    }
    const cands = byTitle.get(titleKey(page.title)) ?? []
    let product: Product | undefined
    let how = "название"
    if (cands.length === 1) product = cands[0]
    else if (cands.length > 1) {
      stats.ambiguous++
      rows.push(`несколько товаров с таким названием;${url};${page.title};${cands.map((c) => c.handle).join(" | ")};;`)
      return
    } else {
      product = bySlug.get(slugKey(url.replace(/\/+$/, "").split("/").pop() ?? ""))
      how = "адрес"
    }
    if (!product) {
      stats.not_found++
      rows.push(`нет на новом сайте;${url};${page.title};;${page.description.length};${page.images.length}`)
      return
    }
    // Тот же товар в другом разделе старого сайта — повтор, обрабатывается один раз
    if (used.has(product.id)) {
      stats.duplicates++
      return
    }
    used.add(product.id)
    how === "адрес" ? stats.by_url++ : stats.matched++
    if (product.metadata?.old_site_import && !force) {
      stats.already++
      rows.push(`уже перенесён;${url};${page.title};${product.handle};${page.description.length};${page.images.length}`)
      return
    }
    rows.push(`${how === "адрес" ? "найден по адресу" : "найден"};${url};${page.title};${product.handle};${page.description.length};${page.images.length}`)
    if (!apply) return

    try {
      // Фото: скачиваем со старого сайта и кладём в хранилище сайта (S3); нет фото — оставляем прежние
      let urlsNew: string[] = []
      if (page.images.length) {
        const downloaded = await Promise.all(page.images.map(async (src, i) => {
          const res = await get(src)
          const type = res.headers.get("content-type") || "image/jpeg"
          const ext = (src.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"
          return { filename: `${product!.handle}-${i + 1}.${ext}`, mimeType: type.startsWith("image/") ? type : "image/jpeg", content: Buffer.from(await res.arrayBuffer()).toString("base64"), access: "public" as const }
        }))
        const { result } = await uploadFilesWorkflow(container).run({ input: { files: downloaded } })
        urlsNew = result.map((f) => f.url)
      }
      const oldImages = product.images ?? []
      await updateProductsWorkflow(container).run({
        input: {
          products: [{
            id: product.id,
            ...(page.description ? { description: page.description } : {}),
            ...(urlsNew.length ? { images: urlsNew.map((u) => ({ url: u })), thumbnail: urlsNew[0] } : {}),
            metadata: {
              ...(product.metadata ?? {}),
              old_site_import: new Date().toISOString(),
              ...(product.metadata?.old_site_url ? {} : { old_site_url: url }),
            },
          }],
        },
      })
      // Прежние файлы фото больше не нужны — освобождаем место в хранилище
      if (urlsNew.length && fileBase) {
        const keys = oldImages.map((im) => im.url).filter((u) => u.startsWith(`${fileBase}/`)).map((u) => u.slice(fileBase.length + 1))
        if (keys.length) await files.deleteFiles(keys).catch((e: Error) => logger.warn(`Не удалены старые фото ${product!.handle}: ${e.message}`))
      }
      stats.updated++
    } catch (e) {
      stats.failed++
      rows.push(`ошибка записи;${url};${page.title};${product.handle};${(e as Error).message};`)
    }
  })

  console.log("\n===ОТЧЁТ===")
  console.log(rows.join("\n"))
  console.log("===ИТОГ===")
  console.log(JSON.stringify(stats))
  logger.info(`Старый сайт: ${JSON.stringify(stats)}`)
}
