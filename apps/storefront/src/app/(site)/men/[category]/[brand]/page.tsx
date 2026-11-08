import { listingPage, staticParams } from "@/lib/listing-pages"

const { Page, generateMetadata } = listingPage("categoryBrand", { gender: "men" })
export { generateMetadata }
export default Page

export async function generateStaticParams() {
  return staticParams(/^\/men\/([^/]+)\/([^/]+)$/, ["category", "brand"])
}

// Страница ждёт данные целиком: полный HTML сразу важнее мгновенной заготовки (ТЗ, п. 7.1)
export const instant = false
