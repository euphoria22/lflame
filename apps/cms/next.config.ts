import { withPayload } from "@payloadcms/next/withPayload"
import type { NextConfig } from "next"
import path from "path"
import { fileURLToPath } from "url"

const dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Payload CMS — отдельное приложение (ТЗ, п. 8.2: админки на admin-поддомене).
 * Cache Components здесь не включаются: админка Payload их не поддерживает.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
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
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
