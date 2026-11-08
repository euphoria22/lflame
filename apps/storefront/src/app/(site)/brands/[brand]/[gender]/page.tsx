import { listingPage, staticParams } from "@/lib/listing-pages"

const { Page, generateMetadata } = listingPage("brandGender")
export { generateMetadata }
export default Page

export async function generateStaticParams() {
  return staticParams(/^\/brands\/([^/]+)\/(men|women)$/, ["brand", "gender"])
}

// Страница ждёт данные целиком: полный HTML сразу важнее мгновенной заготовки (ТЗ, п. 7.1)
export const instant = false
