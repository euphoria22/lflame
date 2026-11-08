/** Общие константы сайта. */
export const SITE_NAME = "LAFLAMME"

/** Главное зеркало без слеша на конце (ТЗ, п. 7.2). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:8000").replace(/\/+$/, "")
