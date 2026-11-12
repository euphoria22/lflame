import type { Metadata, Viewport } from "next"
import { Martian_Mono, Onest } from "next/font/google"
import { Suspense } from "react"

import { AnnouncementBar } from "@/components/announcement-bar"
import { CartDrawer } from "@/components/cart-drawer"
import { CartProvider } from "@/components/cart-context"
import { FavoritesProvider } from "@/components/favorites-context"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { JsonLd } from "@/components/json-ld"
import { safeAnnouncement } from "@/lib/blog"
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, SOCIAL } from "@/lib/site"
import { CookieConsent } from "@/components/cookie-consent"
import "./globals.css"

// Шрифт собирается при сборке и раздаётся с нашего сервера (ТЗ, п. 7.10)
// Основной шрифт — Onest; акцентный (бирки: бренд, цены, размеры, уровни Club) — Martian Mono, суженный
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  display: "swap",
})
const martian = Martian_Mono({
  variable: "--font-martian",
  subsets: ["latin", "cyrillic"],
  axes: ["wdth"],
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `Мультибрендовый магазин оригинальной одежды и обуви | ${SITE_NAME}`,
    template: `%s`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, locale: "ru_RU", type: "website" },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Полоска с акциями: её высота сдвигает шапку и начало страницы (переменная --bar)
  const bar = await safeAnnouncement()
  return (
    <html lang="ru" data-scroll-behavior="smooth" className={`${onest.variable} ${martian.variable} antialiased`} style={{ "--bar": bar ? "34px" : "0px" } as React.CSSProperties}>
      <body className="flex min-h-screen flex-col">
        {/* Клавиатура (Tab) включает обводку фокуса, клик или касание — выключает */}
        <script dangerouslySetInnerHTML={{ __html: `(function(d){var h=d.documentElement;d.addEventListener("keydown",function(e){if(e.key==="Tab")h.setAttribute("data-kbd","")},true);d.addEventListener("pointerdown",function(){h.removeAttribute("data-kbd")},true)})(document)` }} />
        <CartProvider>
          <FavoritesProvider>
          {bar && <AnnouncementBar data={bar} />}
          <Header />
          <main className="flex-1 pt-[calc(84px+var(--bar))]">{children}</main>
          <Footer />
          <CartDrawer />
          <Suspense fallback={null}><CookieConsent /></Suspense>
          </FavoritesProvider>
        </CartProvider>
        <JsonLd data={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: SITE_NAME,
            url: SITE_URL,
            logo: `${SITE_URL}/icon.png`,
            sameAs: SOCIAL.map((s) => s.url),
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: SITE_NAME,
            url: SITE_URL,
            potentialAction: {
              "@type": "SearchAction",
              target: `${SITE_URL}/search?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          },
        ]} />
      </body>
    </html>
  )
}
