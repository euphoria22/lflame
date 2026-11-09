import type { GlobalConfig } from "payload"

import { revalidateStorefront } from "../lib/revalidate"

/**
 * Полоска с акциями над шапкой сайта. Несколько сообщений сменяют друг друга.
 * После «Сохранить» сайт обновится сам.
 */
export const Announcement: GlobalConfig = {
  slug: "announcement",
  label: "Плашка с акциями",
  admin: { group: "Контент", description: "Тонкая полоска над шапкой сайта: акции, бесплатная доставка, новости." },
  access: { read: () => true },
  fields: [
    { name: "enabled", type: "checkbox", label: "Показывать на сайте", defaultValue: true },
    {
      name: "theme", type: "select", label: "Цвет", defaultValue: "dark",
      options: [
        { label: "Чёрная", value: "dark" },
        { label: "Красная (распродажа)", value: "sale" },
        { label: "Светлая", value: "light" },
      ],
    },
    {
      name: "items", type: "array", label: "Сообщения", minRows: 1, maxRows: 5,
      admin: { description: "Если сообщений несколько — они сменяют друг друга каждые 5 секунд" },
      labels: { singular: "Сообщение", plural: "Сообщения" },
      fields: [
        { name: "text", type: "text", label: "Текст", required: true, maxLength: 110, admin: { description: "До ~45 символов вместе со ссылкой — тогда помещается и на телефоне" } },
        { name: "link", type: "text", label: "Ссылка (необязательно)", admin: { description: "Например /sale или /loyalty" } },
        { name: "linkLabel", type: "text", label: "Текст ссылки", defaultValue: "Подробнее", maxLength: 30 },
      ],
    },
  ],
  hooks: {
    afterChange: [async () => { await revalidateStorefront(["announcement"]) }],
  },
}
