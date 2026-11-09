import type { Field, GlobalConfig } from "payload"

import { revalidateStorefront } from "../lib/revalidate"

/** Категории каталога (адреса как на сайте: /men/kurtki). Новая категория в МойСклад — добавить сюда. */
export const MENU_CATEGORIES = [
  { label: "Куртки", value: "kurtki" },
  { label: "Худи и свитшоты", value: "hudi-i-svitshoty" },
  { label: "Свитеры и кардиганы", value: "svitery-i-kardigany" },
  { label: "Футболки и лонгсливы", value: "futbolki-i-longslivy" },
  { label: "Рубашки и поло", value: "rubashki-i-polo" },
  { label: "Брюки", value: "bryuki" },
  { label: "Джинсы", value: "dzhinsy" },
  { label: "Шорты", value: "shorty" },
  { label: "Обувь", value: "obuv" },
  { label: "Головные уборы", value: "golovnye-ubory" },
  { label: "Сумки и рюкзаки", value: "sumki-i-ryukzaki" },
  { label: "Аксессуары", value: "aksessuary" },
  { label: "Нижнее белье и носки", value: "nizhnee-bele-i-noski" },
]

const tiles = (name: string, label: string): Field => ({
  name, type: "array", label, maxRows: 3,
  labels: { singular: "Плитка", plural: "Плитки" },
  admin: { description: "До 3 плиток с фото справа в выпадающем меню. Пусто — «Куртки», «Худи и свитшоты», «Свитеры и кардиганы» с фото из каталога" },
  fields: [
    { name: "category", type: "select", label: "Категория", required: true, options: MENU_CATEGORIES },
    { name: "label", type: "text", label: "Подпись (необязательно)", maxLength: 30, admin: { description: "Пусто — название категории" } },
    { name: "image", type: "upload", relationTo: "media", label: "Фото (необязательно)", admin: { description: "Вертикальное 3:4, от 900×1200 px. Пусто — фото товара из этой категории" } },
  ],
})

/** Выпадающее меню «Мужское» / «Женское»: плитки с фото — сезонные категории. */
export const Menu: GlobalConfig = {
  slug: "menu",
  label: "Меню сайта",
  admin: { group: "Контент", description: "Плитки с фото в выпадающем меню «Мужское» и «Женское» — например, категории, которые лучше продаются в сезон." },
  access: { read: () => true },
  fields: [tiles("men", "Мужское"), tiles("women", "Женское")],
  hooks: {
    afterChange: [async () => { await revalidateStorefront(["menu"]) }],
  },
}
