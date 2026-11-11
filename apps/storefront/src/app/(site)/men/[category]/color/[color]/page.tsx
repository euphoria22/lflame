import { listingPage, staticParams } from "@/lib/listing-pages"

// Посадочная по цвету: «Чёрные худи и свитшоты мужские»
const { Page, generateMetadata } = listingPage("categoryColor", { gender: "men" })
export { generateMetadata }
export default Page

export async function generateStaticParams() {
  return staticParams(/^\/men\/([^/]+)\/color\/([^/]+)$/, ["category", "color"])
}

// Страница ждёт данные целиком: полный HTML сразу важнее мгновенной заготовки (ТЗ, п. 7.1)
export const instant = false
