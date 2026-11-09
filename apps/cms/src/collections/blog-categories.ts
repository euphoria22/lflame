import type { CollectionConfig } from "payload"

import { revalidateStorefront } from "../lib/revalidate"
import { slugify } from "../lib/slug"

/** Рубрики блога: «Новости», «Стиль», «Бренды»… */
export const BlogCategories: CollectionConfig = {
  slug: "blog-categories",
  labels: { singular: "Рубрика", plural: "Рубрики блога" },
  admin: { useAsTitle: "name", group: "Блог", defaultColumns: ["name", "slug"] },
  access: { read: () => true },
  fields: [
    { name: "name", type: "text", label: "Название", required: true },
    {
      name: "slug", type: "text", label: "Адрес", unique: true, index: true,
      admin: { description: "Латиница, заполнится сам из названия" },
      hooks: { beforeValidate: [({ value, data }) => value || slugify(String(data?.name ?? ""))] },
    },
  ],
  hooks: {
    afterChange: [async () => { await revalidateStorefront(["blog"]) }],
    afterDelete: [async () => { await revalidateStorefront(["blog"]) }],
  },
}
