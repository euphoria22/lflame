import { listingPage, staticParams } from "@/lib/listing-pages"

// Посадочная по цвету: «Чёрные худи и свитшоты женские»
const { Page, generateMetadata } = listingPage("categoryColor", { gender: "women" })
export { generateMetadata }
export default Page

export async function generateStaticParams() {
  return staticParams(/^\/women\/([^/]+)\/color\/([^/]+)$/, ["category", "color"])
}

// Страница ждёт данные целиком: полный HTML сразу важнее мгновенной заготовки (ТЗ, п. 7.1)
export const instant = false
