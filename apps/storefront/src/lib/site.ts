/** Общие константы сайта. */
export const SITE_NAME = "Laflamme"

/** Конец названия каждой страницы: «Каталог | Laflamme» */
export const TITLE_SUFFIX = ` | ${SITE_NAME}`

/** «Корзина» -> «Корзина | Laflamme» */
export const pageTitle = (title: string) => `${title}${TITLE_SUFFIX}`

export const SITE_DESCRIPTION = "Оригинальная одежда, обувь и аксессуары мировых брендов. Доставка по России, оплата частями."

/** Главное зеркало без слеша на конце (ТЗ, п. 7.2). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:8000").replace(/\/+$/, "")

/** Индексация разрешена только на production (ТЗ, п. 7.8: staging закрыт). */
export const INDEXING_ENABLED = process.env.INDEXING === "on"

/** Соцсети магазина: подвал, «Контакты», микроразметка. */
export const SOCIAL = [
  { id: "vk", name: "ВКонтакте", url: "https://vk.ru/laflammeru" },
  { id: "telegram", name: "Telegram", url: "https://t.me/laflammeru" },
] as const
