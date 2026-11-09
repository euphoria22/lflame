import { postgresAdapter } from "@payloadcms/db-postgres"
import { lexicalEditor } from "@payloadcms/richtext-lexical"
import { ru } from "@payloadcms/translations/languages/ru"
import path from "path"
import { buildConfig } from "payload"
import sharp from "sharp"
import { fileURLToPath } from "url"

import { BlogCategories } from "./collections/blog-categories"
import { Media } from "./collections/media"
import { Pages } from "./collections/pages"
import { Posts } from "./collections/posts"
import { Users } from "./collections/users"
import { Announcement } from "./globals/announcement"
import { Home } from "./globals/home"
import { Menu } from "./globals/menu"
import { seedPages } from "./seed/pages"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Payload CMS: контент сайта (ТЗ, п. 1.3, 9).
 * Баннеры, блоки главной, страницы, журнал. Товары и заказы — в Medusa.
 * Отдельное приложение apps/cms, админка по адресу /cms.
 * На production доступна только с admin-поддомена (ТЗ, п. 8.2).
 * Витрина читает контент через REST API (/api) и кэширует его тегами.
 */
export default buildConfig({
  serverURL: process.env.CMS_URL,
  routes: {
    admin: "/cms",
  },
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: " | LAFLAMME CMS",
    },
    importMap: {
      baseDir: path.resolve(dirname),
      importMapFile: path.resolve(dirname, "app/(payload)/cms/importMap.js"),
    },
  },
  i18n: {
    supportedLanguages: { ru },
    fallbackLanguage: "ru",
  },
  collections: [Pages, Posts, BlogCategories, Media, Users],
  globals: [Home, Menu, Announcement],
  // Стартовые тексты страниц (доставка, оплата, оферта…) — только если их ещё нет
  onInit: async (payload) => {
    await seedPages(payload).catch((e) => payload.logger.error(`Стартовые страницы не созданы: ${(e as Error).message}`))
    // Стартовая плашка: бесплатная доставка (если плашку ещё не заполняли)
    const a = await payload.findGlobal({ slug: "announcement" }).catch(() => null)
    // Программа переименована в LAFLAMME Club: стартовую фразу меняем, только если её не правили
    const items = (a as { items?: { text?: string }[] } | null)?.items ?? []
    if (a && items.some((i) => i.text === "Скидка до 15% по программе LAFLAMME")) {
      await payload.updateGlobal({
        slug: "announcement",
        data: { items: items.map((i) => (i.text === "Скидка до 15% по программе LAFLAMME" ? { ...i, text: "Скидка до 15% в LAFLAMME Club" } : i)) as never },
      }).catch(() => null)
    }
    if (a && !(a as { items?: unknown[] }).items?.length) {
      await payload.updateGlobal({
        slug: "announcement",
        data: { enabled: true, theme: "dark", items: [
          { text: "Бесплатная доставка от 12 000 ₽", link: "/delivery", linkLabel: "Подробнее" },
          { text: "Скидка до 15% в LAFLAMME Club", link: "/loyalty", linkLabel: "Как получить" },
        ] },
      }).catch(() => null)
    }
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.PAYLOAD_DATABASE_URL || "",
    },
  }),
  sharp,
  telemetry: false,
})
