import type { CollectionConfig } from "payload"

import { revalidateStorefront } from "../lib/revalidate"
import { slugify } from "../lib/slug"

/**
 * Статьи блога (ТЗ, п. 6.1 «Журнал», 7.11). Черновики видны только в CMS;
 * на сайте — опубликованные. После публикации витрина обновляется сама.
 */
export const Posts: CollectionConfig = {
  slug: "posts",
  labels: { singular: "Статья", plural: "Статьи" },
  admin: {
    useAsTitle: "title",
    group: "Блог",
    defaultColumns: ["title", "category", "publishedAt", "_status"],
    description: "Обложка, заголовок, текст — и «Опубликовать». Товары из статьи можно показать лентой внизу.",
  },
  versions: { drafts: true },
  access: {
    // Гостям — только опубликованные
    read: ({ req }) => (req.user ? true : { _status: { equals: "published" } }),
  },
  defaultSort: "-publishedAt",
  fields: [
    { name: "title", type: "text", label: "Заголовок", required: true, maxLength: 140 },
    {
      name: "slug", type: "text", label: "Адрес статьи", unique: true, index: true,
      admin: { position: "sidebar", description: "/blog/… — латиница, заполнится сам из заголовка" },
      hooks: { beforeValidate: [({ value, data }) => slugify(String(value || data?.title || ""))] },
    },
    {
      name: "publishedAt", type: "date", label: "Дата публикации",
      admin: { position: "sidebar", date: { pickerAppearance: "dayOnly", displayFormat: "d MMMM yyyy" } },
      hooks: { beforeChange: [({ value, siblingData }) => value || (siblingData?._status === "published" ? new Date().toISOString() : value)] },
    },
    { name: "category", type: "relationship", relationTo: "blog-categories", label: "Рубрика", admin: { position: "sidebar" } },
    { name: "cover", type: "upload", relationTo: "media", label: "Обложка", required: true, admin: { description: "Вертикальное или квадратное фото, от 1600 px" } },
    { name: "excerpt", type: "textarea", label: "Анонс", maxLength: 300, admin: { description: "2–3 предложения для списка статей и поисковиков" } },
    { name: "content", type: "richText", label: "Текст", required: true },
    {
      name: "products", type: "textarea", label: "Товары из статьи",
      admin: { description: "Ссылки на товары сайта или их адреса (handle), по одному в строке — покажем лентой под статьёй" },
    },
    {
      name: "seo", type: "group", label: "SEO",
      fields: [
        { name: "title", type: "text", label: "Title (если пусто — заголовок)", maxLength: 70 },
        { name: "description", type: "textarea", label: "Description (если пусто — анонс)", maxLength: 170 },
      ],
    },
  ],
  hooks: {
    afterChange: [async ({ doc }) => { await revalidateStorefront(["blog", `blog:${doc.slug}`]) }],
    afterDelete: [async ({ doc }) => { await revalidateStorefront(["blog", `blog:${doc.slug}`]) }],
  },
}
