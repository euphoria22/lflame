import type { MetadataRoute } from "next"

import { SITE_NAME } from "@/lib/site"

/** Манифест: иконка и название при добавлении сайта на главный экран телефона. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — оригинальная одежда и обувь`,
    short_name: SITE_NAME,
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }
}
