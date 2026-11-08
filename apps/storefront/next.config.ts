import type { NextConfig } from "next"
import path from "path"
import { fileURLToPath } from "url"

const dirname = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // ТЗ, п. 7.2: адреса без слеша на конце
  trailingSlash: false,
  poweredByHeader: false,
  // "use cache" + cacheTag: страницы каталога обновляются по событию из Medusa и CMS (ТЗ, п. 7.1)
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
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
