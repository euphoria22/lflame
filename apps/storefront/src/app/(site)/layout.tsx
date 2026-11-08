import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"

import { SITE_NAME, SITE_URL } from "@/lib/site"
import "./globals.css"

// Шрифт собирается при сборке и раздаётся с нашего сервера (ТЗ, п. 7.10)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — мультибрендовый магазин одежды`,
    template: `%s | ${SITE_NAME}`,
  },
  description: "Оригинальная одежда, обувь и аксессуары мировых брендов. Доставка по России.",
  applicationName: SITE_NAME,
  openGraph: {
    siteName: SITE_NAME,
    locale: "ru_RU",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
