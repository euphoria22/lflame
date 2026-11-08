import { listingPage, staticParams } from "@/lib/listing-pages"

const { Page, generateMetadata } = listingPage("category", { gender: "women" })
export { generateMetadata }
export default Page

export async function generateStaticParams() {
  return staticParams(/^\/women\/([^/]+)$/, ["category"])
}

// Страница ждёт данные целиком: полный HTML сразу важнее мгновенной заготовки (ТЗ, п. 7.1)
export const instant = false
