/** Цвета статусов заказа и формат даты — для кабинета. */

export const STATUS_STYLE: Record<string, string> = {
  delivered: "bg-[#e6f4ea] text-[#1e6b34]",
  canceled: "bg-[#fbe9e9] text-sale",
  shipped: "bg-foreground text-background",
  awaiting: "bg-[#f5ece3] text-[#7a5a3a]",
  new: "bg-[#f5ece3] text-[#7a5a3a]",
  packed: "bg-[#f5ece3] text-[#7a5a3a]",
}

export const orderDate = (s: string) => new Date(s).toLocaleDateString("ru-RU")
