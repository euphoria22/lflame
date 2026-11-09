import type { CollectionConfig } from "payload"

/**
 * Изображения для баннеров и страниц.
 * Фото товаров хранятся в Medusa, не здесь.
 */
export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Изображение", plural: "Изображения" },
  admin: { group: "Контент" },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "alt",
      type: "text",
      label: "Описание для поисковиков (alt)",
      required: true,
    },
  ],
  upload: {
    // ТЗ, п. 8.3: только изображения
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    // Уменьшенные копии для сайта (оригинал тоже хранится)
    imageSizes: [
      { name: "card", width: 800, withoutEnlargement: true },
      { name: "large", width: 1600, withoutEnlargement: true },
    ],
  },
}
