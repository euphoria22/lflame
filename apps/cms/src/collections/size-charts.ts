import type { CollectionConfig } from "payload"

import { MENU_CATEGORIES } from "../globals/menu"
import { revalidateStorefront } from "../lib/revalidate"

/**
 * Таблицы размеров: на странице товара ссылка «Таблица размеров» открывает подходящую.
 * Подбор: раздел (мужское / женское) и категория товара; таблица с брендом важнее общей.
 */
export const SizeCharts: CollectionConfig = {
  slug: "size-charts",
  labels: { singular: "Таблица размеров", plural: "Таблицы размеров" },
  admin: {
    group: "Контент",
    useAsTitle: "title",
    defaultColumns: ["title", "gender", "categories", "brands"],
    description: "Показываются на странице товара по ссылке «Таблица размеров». Таблицу удобно вставить из Excel или Google Таблиц.",
  },
  access: { read: () => true },
  fields: [
    { name: "title", type: "text", label: "Заголовок", required: true, admin: { description: "Например «Размеры мужской одежды»" } },
    {
      name: "gender", type: "select", label: "Раздел", required: true, defaultValue: "men",
      options: [{ label: "Мужское", value: "men" }, { label: "Женское", value: "women" }, { label: "Для всех", value: "all" }],
      admin: { description: "Товары «унисекс» получают мужскую таблицу, если нет отдельной" },
    },
    { name: "categories", type: "select", label: "Категории", hasMany: true, required: true, options: MENU_CATEGORIES },
    { name: "brands", type: "text", label: "Только для брендов (необязательно)", admin: { description: "Через запятую, как на сайте: «Stone Island, C.P. Company». Пусто — для всех брендов" } },
    {
      name: "sections", type: "array", label: "Таблицы", minRows: 1, labels: { singular: "Таблица", plural: "Таблицы" },
      fields: [
        { name: "title", type: "text", label: "Название (необязательно)", admin: { description: "Например «Сорочки»" } },
        {
          name: "table", type: "textarea", label: "Таблица", required: true,
          admin: {
            rows: 8,
            description: "Каждая строка таблицы — с новой строки, ячейки — через Tab (так вставляется из Excel) или «;». Первая ячейка строки — название строки",
          },
        },
      ],
    },
    { name: "image", type: "upload", relationTo: "media", label: "Картинка (необязательно)", admin: { description: "Например схема размеров колготок или как снимать мерки — показывается под таблицами" } },
    { name: "note", type: "textarea", label: "Как измерить (необязательно)", admin: { rows: 6, description: "Текст под таблицами. **жирный** — выделить" } },
    { name: "order", type: "number", label: "Порядок", defaultValue: 0 },
  ],
  hooks: {
    afterChange: [async () => { await revalidateStorefront(["size-charts"]) }],
    afterDelete: [async () => { await revalidateStorefront(["size-charts"]) }],
  },
}
