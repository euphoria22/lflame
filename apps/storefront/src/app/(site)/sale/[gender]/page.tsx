import { listingPage } from "@/lib/listing-pages"

const { Page, generateMetadata } = listingPage("sale")
export { generateMetadata }
export default Page

export function generateStaticParams() {
  return [{ gender: "men" }, { gender: "women" }]
}

// Страница ждёт данные целиком: полный HTML сразу важнее мгновенной заготовки (ТЗ, п. 7.1)
export const instant = false
