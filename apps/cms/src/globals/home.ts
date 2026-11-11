import type { GlobalConfig } from "payload"

import { revalidateStorefront } from "../lib/revalidate"

/**
 * Главная страница: баннер-кампания первого экрана (как у LEFORM / Brandshop).
 * Пока баннер выключен или нет фото — сайт показывает две карточки «Мужское» / «Женское».
 */
export const Home: GlobalConfig = {
  slug: "home",
  label: "Главная страница",
  admin: { group: "Контент", description: "Баннер первого экрана: фото кампании, заголовок, кнопки." },
  access: { read: () => true },
  fields: [
    {
      name: "hero", type: "group", label: "Баннер первого экрана",
      fields: [
        { name: "enabled", type: "checkbox", label: "Показывать баннер", defaultValue: true },
        { name: "image", type: "upload", relationTo: "media", label: "Фото для компьютера", admin: { description: "Широкое, примерно 21:9 или 16:9, от 2400 px по ширине. Главное — по центру" } },
        {
          name: "video", type: "upload", relationTo: "media", label: "Видео или GIF (необязательно)",
          admin: { description: "MP4 (H.264) или WebM, до 60 секунд, без звука, лучше до 20 МБ (или GIF). Видео с iPhone (HEVC) Chrome не показывает — сохраните в H.264. Играет по кругу; фото выше — обложка, пока видео грузится" },
        },
        { name: "imageMobile", type: "upload", relationTo: "media", label: "Фото для телефона (необязательно)", admin: { description: "Вертикальное 4:5. Пусто — обрежем фото для компьютера" } },
        {
          name: "focus", type: "select", label: "Какую часть фото показывать", defaultValue: "center",
          admin: { description: "Если фото обрезается неудачно (например, не видно лица) — выберите «Верх»" },
          options: [{ label: "Верх", value: "top" }, { label: "Центр", value: "center" }, { label: "Низ", value: "bottom" }],
        },
        { name: "eyebrow", type: "text", label: "Надпись над заголовком", maxLength: 40, admin: { description: "Например «Осень — зима 2026»" } },
        { name: "title", type: "text", label: "Заголовок", maxLength: 40, admin: { description: "Например «Новая коллекция»" } },
        {
          name: "textColor", type: "select", label: "Цвет текста", defaultValue: "light",
          options: [{ label: "Белый (для тёмного фото)", value: "light" }, { label: "Чёрный (для светлого фото)", value: "dark" }],
        },
        {
          name: "buttons", type: "array", label: "Кнопки", maxRows: 3,
          admin: { description: "Пусто — кнопки «Мужское» и «Женское»" },
          labels: { singular: "Кнопка", plural: "Кнопки" },
          fields: [
            { name: "label", type: "text", label: "Текст", required: true, maxLength: 24 },
            { name: "link", type: "text", label: "Ссылка", required: true, admin: { description: "Например /men, /women, /new, /sale" } },
          ],
        },
      ],
    },
  ],
  hooks: {
    afterChange: [async () => { await revalidateStorefront(["home"]) }],
  },
}
