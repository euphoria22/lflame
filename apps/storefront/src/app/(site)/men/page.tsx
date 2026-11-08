import { listingPage } from "@/lib/listing-pages"

const { Page, generateMetadata } = listingPage("gender", { gender: "men" })
export { generateMetadata }
export default Page

// Страница ждёт данные целиком: полный HTML сразу важнее мгновенной заготовки (ТЗ, п. 7.1)
export const instant = false
