import type { CollectionConfig } from "payload"

/** Сотрудники, которые редактируют контент сайта. */
export const Users: CollectionConfig = {
  slug: "users",
  labels: { singular: "Сотрудник", plural: "Сотрудники" },
  admin: {
    useAsTitle: "email",
    group: "Настройки",
  },
  auth: {
    // ТЗ, п. 8.2: ограничение попыток входа
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    tokenExpiration: 8 * 60 * 60,
  },
  fields: [
    { name: "name", type: "text", label: "Имя" },
  ],
}
