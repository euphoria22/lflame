import type { NextConfig } from "next"
import path from "path"
import { fileURLToPath } from "url"

const dirname = path.dirname(fileURLToPath(import.meta.url))

function imageHosts() {
  const urls = [process.env.MEDUSA_BACKEND_URL || "http://localhost:9000", process.env.IMAGES_CDN_URL].filter(Boolean) as string[]
  return urls.map((u) => {
    const url = new URL(u)
    return { protocol: url.protocol.replace(":", "") as "http" | "https", hostname: url.hostname, port: url.port, pathname: "/**" }
  })
}

const nextConfig: NextConfig = {
  // ТЗ, п. 7.2: адреса без слеша на конце. Встроенный редирект Next.js отдаёт 308,
  // поэтому он выключен, а 301 делает src/proxy.ts
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
  // "use cache" + cacheTag: страницы каталога обновляются по событию из Medusa и CMS (ТЗ, п. 7.1)
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
    // Фото товаров: бэкенд Medusa (локально) и S3/CDN (production) — адреса из переменных
    remotePatterns: imageHosts(),
    // Фото на белом фоне сжимаются хорошо; 75 — баланс качества и веса (ТЗ, п. 7.10)
    qualities: [75, 85],
    // Локально фото отдаёт Medusa с localhost; на production — публичный CDN, там запрет остаётся
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
  turbopack: {
    root: path.resolve(dirname, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
