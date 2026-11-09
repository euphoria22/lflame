import { Mail } from "./mailer"

/**
 * Письма покупателю (ТЗ, п. 6.6): минималистичный шаблон в стиле сайта — белый фон, чёрный текст.
 * Вёрстка таблицами и встроенными стилями: так письма одинаково выглядят в Яндекс Почте, Mail.ru и Gmail.
 */

export const site = () => (process.env.STOREFRONT_URL || "http://localhost:8000").replace(/\/+$/, "")
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
export const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ")} ₽`

export function layout(opts: { preheader: string; title: string; body: string; button?: { label: string; url: string } }): string {
  const btn = opts.button
    ? `<tr><td style="padding:8px 0 24px"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#0b0b0b;color:#fff;text-decoration:none;font-size:14px;padding:14px 28px;border-radius:999px">${esc(opts.button.label)}</a></td></tr>`
    : ""
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(opts.title)}</title></head>
<body style="margin:0;background:#f3f3f2;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0b0b0b">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f2;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;padding:32px">
<tr><td style="font-size:13px;letter-spacing:6px;padding-bottom:28px"><a href="${site()}" style="color:#0b0b0b;text-decoration:none">LAFLAMME</a></td></tr>
<tr><td style="font-size:24px;line-height:1.25;padding-bottom:16px">${esc(opts.title)}</td></tr>
<tr><td style="font-size:14px;line-height:1.6;color:#3a3a3a;padding-bottom:16px">${opts.body}</td></tr>
${btn}
<tr><td style="border-top:1px solid #e7e7e7;padding-top:20px;font-size:12px;line-height:1.6;color:#6e6e6e">
Магазин LAFLAMME · Омск, ул. Партизанская, 5а/8 · ежедневно 12:00–21:00<br>
<a href="${site()}" style="color:#6e6e6e">${esc(site().replace(/^https?:\/\//, ""))}</a>
</td></tr></table></td></tr></table></body></html>`
}

export function loginCodeMail(to: string, code: string): Mail {
  return {
    to,
    subject: `${code} — код для входа в LAFLAMME`,
    text: `Код для входа: ${code}\nДействует 10 минут. Если вы не запрашивали код — просто удалите письмо.`,
    html: layout({
      preheader: `Код для входа: ${code}`,
      title: "Код для входа",
      body: `<div style="font-size:34px;letter-spacing:8px;color:#0b0b0b;padding:8px 0 16px">${esc(code)}</div>Действует 10 минут. Если вы не запрашивали код — просто удалите письмо.`,
    }),
  }
}

export type MailOrder = {
  display_id: number
  email: string | null
  total: number
  item_total: number
  shipping_total: number
  discount_total?: number
  payment_method?: string | null
  customer_name: string
  shipping_name: string
  address: string
  items: { title: string; variant: string; quantity: number; unit_price: number; preorder?: boolean }[]
  tracking?: { number: string; url: string } | null
}

export type OrderMailKind = "placed" | "paid" | "shipped" | "delivered" | "canceled"

function itemsTable(o: MailOrder): string {
  const rows = o.items.map((i) => `<tr><td style="padding:6px 0;font-size:14px">${esc(i.title)}<br><span style="color:#6e6e6e;font-size:12px">${esc(i.variant)} · ${i.quantity} шт.${i.preorder ? " · предзаказ" : ""}</span></td><td align="right" style="padding:6px 0;font-size:14px;white-space:nowrap">${rub(i.unit_price * i.quantity)}</td></tr>`).join("")
  const line = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:3px 0;font-size:${strong ? 16 : 13}px;color:${strong ? "#0b0b0b" : "#6e6e6e"}">${label}</td><td align="right" style="padding:3px 0;font-size:${strong ? 16 : 13}px">${value}</td></tr>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-top:1px solid #e7e7e7;border-bottom:1px solid #e7e7e7;padding:10px 0">${rows}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${line("Товары", rub(o.item_total))}
${o.discount_total ? line("Скидка", `−${rub(o.discount_total)}`) : ""}
${line("Доставка", o.shipping_total ? rub(o.shipping_total) : "бесплатно")}
${line("Итого", rub(o.total), true)}</table>
<p style="font-size:13px;color:#6e6e6e;margin:16px 0 0">${esc(o.shipping_name)}${o.address ? `<br>${esc(o.address)}` : ""}</p>`
}

export function orderMail(kind: OrderMailKind, o: MailOrder): Mail {
  const n = `№ ${o.display_id}`
  const account = { label: "Мои заказы", url: `${site()}/account` }
  const paidOnline = o.payment_method === "tbank"
  const variants: Record<OrderMailKind, { subject: string; title: string; text: string; withItems: boolean; button?: { label: string; url: string } }> = {
    placed: {
      subject: `Заказ ${n} оформлен`,
      title: `Спасибо! Заказ ${n} оформлен`,
      text: paidOnline
        ? "Оплата получена. Соберём заказ и пришлём трек-номер, когда передадим его в доставку."
        : "Мы позвоним, чтобы подтвердить заказ. Оплата — при получении.",
      withItems: true,
      button: account,
    },
    paid: {
      subject: `Заказ ${n} оплачен`,
      title: `Заказ ${n} оплачен`,
      text: "Спасибо, оплата получена. Соберём заказ и пришлём трек-номер.",
      withItems: false,
      button: account,
    },
    shipped: {
      subject: `Заказ ${n} передан в доставку`,
      title: `Заказ ${n} в пути`,
      text: o.tracking ? `Трек-номер: <b>${esc(o.tracking.number)}</b>. По нему можно следить за посылкой.` : "Заказ передан в службу доставки.",
      withItems: false,
      button: o.tracking?.url ? { label: "Отследить посылку", url: o.tracking.url } : account,
    },
    delivered: {
      subject: `Заказ ${n} получен`,
      title: `Заказ ${n} получен`,
      text: "Надеемся, всё подошло. Если нужно обменять или вернуть вещь — ответьте на это письмо или позвоните нам.",
      withItems: false,
      button: { label: "Смотреть новинки", url: `${site()}/new` },
    },
    canceled: {
      subject: `Заказ ${n} отменён`,
      title: `Заказ ${n} отменён`,
      text: paidOnline ? "Деньги вернутся на карту в течение нескольких дней — срок зависит от банка." : "Если это ошибка — ответьте на письмо или позвоните нам.",
      withItems: false,
    },
  }
  const v = variants[kind]
  const plainItems = v.withItems ? `\n\n${o.items.map((i) => `${i.title} (${i.variant}) × ${i.quantity} — ${rub(i.unit_price * i.quantity)}`).join("\n")}\nИтого: ${rub(o.total)}` : ""
  return {
    to: o.email ?? "",
    subject: v.subject,
    text: `${v.title}\n\n${v.text.replace(/<[^>]+>/g, "")}${plainItems}\n\n${v.button ? `${v.button.label}: ${v.button.url}` : ""}`,
    html: layout({ preheader: v.text.replace(/<[^>]+>/g, ""), title: v.title, body: `${v.text}${v.withItems ? itemsTable(o) : ""}`, button: v.button }),
  }
}

/** Сообщение магазину о новом заказе (Telegram, HTML-разметка Telegram). */
export function shopOrderMessage(o: MailOrder, adminUrl: string): string {
  const t = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)
  return [
    `🛍 <b>Новый заказ № ${o.display_id}</b> — ${rub(o.total)}`,
    `${t(o.customer_name)} · ${t(o.email)}`,
    `${t(o.shipping_name)}${o.address ? `: ${t(o.address)}` : ""}`,
    `Оплата: ${o.payment_method === "tbank" ? "онлайн (оплачен)" : "при получении"}`,
    "",
    ...o.items.map((i) => `• ${i.preorder ? "⏳ ПРЕДЗАКАЗ · " : ""}${t(i.title)} — ${t(i.variant)} × ${i.quantity}`),
    "",
    `<a href="${adminUrl}">Открыть в админке</a>`,
  ].join("\n")
}
