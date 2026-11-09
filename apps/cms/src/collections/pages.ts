import type { CollectionConfig } from "payload"

import { revalidateStorefront } from "../lib/revalidate"
import { slugify } from "../lib/slug"

/**
 * Информационные страницы сайта (ТЗ, п. 6.1): доставка, оплата, обмен и возврат, контакты,
 * о магазине, оферта, политика конфиденциальности. Адрес на сайте — /{адрес страницы}.
 */
export const Pages: CollectionConfig = {
  slug: "pages",
  labels: { singular: "Страница", plural: "Страницы" },
  admin: {
    useAsTitle: "title",
    group: "Контент",
    defaultColumns: ["title", "slug", "updatedAt"],
    description: "Тексты страниц сайта. После «Сохранить» сайт обновится сам.",
  },
  access: { read: () => true },
  defaultSort: "order",
  fields: [
    { name: "title", type: "text", label: "Заголовок", required: true },
    {
      name: "slug", type: "text", label: "Адрес", unique: true, index: true, required: true,
      admin: { position: "sidebar", description: "Сайт/… — латиница. Не меняйте у оферты (offer) и политики (privacy): на них ссылается оформление заказа." },
      hooks: { beforeValidate: [({ value, data }) => slugify(String(value || data?.title || ""))] },
    },
    { name: "order", type: "number", label: "Порядок", defaultValue: 100, admin: { position: "sidebar" } },
    { name: "intro", type: "textarea", label: "Подзаголовок", admin: { description: "Короткое пояснение под заголовком (необязательно)" } },
    { name: "content", type: "richText", label: "Текст", required: true },
    {
      name: "seo", type: "group", label: "SEO",
      fields: [
        { name: "title", type: "text", label: "Title (если пусто — заголовок)", maxLength: 70 },
        { name: "description", type: "textarea", label: "Description", maxLength: 170 },
      ],
    },
  ],
  hooks: {
    afterChange: [async ({ doc }) => { await revalidateStorefront(["pages", `page:${doc.slug}`]) }],
    afterDelete: [async ({ doc }) => { await revalidateStorefront(["pages", `page:${doc.slug}`]) }],
  },
}
