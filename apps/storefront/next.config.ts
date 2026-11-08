import { withPayload } from "@payloadcms/next/withPayload"
import type { NextConfig } from "next"
import path from "path"
import { fileURLToPath } from "url"

const dirname = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // ТЗ, п. 7.2: адреса без слеша на конце (301 со слешем)
  trailingSlash: false,
  poweredByHeader: false,
  // "use cache" + cacheTag: страницы каталога обновляются по событию из Medusa (ТЗ, п. 7.1)
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
    localPatterns: [{ pathname: "/api/media/file/**" }],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      ".cjs": [".cts", ".cjs"],
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    }
    return webpackConfig
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

export default withPayload(nextConfig, { devBundleServerPackages: false })
