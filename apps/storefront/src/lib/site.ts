/** Общие константы сайта. */
export const SITE_NAME = "LAFLAMME"

export const SITE_DESCRIPTION = "Оригинальная одежда, обувь и аксессуары мировых брендов. Доставка по России, оплата частями."

/** Главное зеркало без слеша на конце (ТЗ, п. 7.2). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:8000").replace(/\/+$/, "")

/** Индексация разрешена только на production (ТЗ, п. 7.8: staging закрыт). */
export const INDEXING_ENABLED = process.env.INDEXING === "on"
