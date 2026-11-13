import { Mail } from "../notify/mailer"
import { layout, rub, site } from "../notify/templates"
import { formatCode } from "./rules"

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
const date = (d: Date | string) => new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Omsk" })

export type MailCard = {
  code: string
  amount: number
  balance: number
  expires_at: Date | string | null
  buyer_name: string | null
  recipient_name: string | null
  message: string | null
}

/** Сама карта в письме: чёрная плашка с логотипом, номиналом и кодом */
function cardBlock(c: MailCard): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0b;border-radius:18px;margin:8px 0 20px">
<tr><td style="padding:24px 24px 0"><img src="${site()}/email-logo-white.png" width="115" height="20" alt="la:flamme" style="display:block;border:0;width:115px;height:20px"></td>
<td align="right" style="padding:24px 24px 0;font-size:11px;letter-spacing:2px;color:#9a9a9a;text-transform:uppercase">Подарочная карта</td></tr>
<tr><td colspan="2" style="padding:36px 24px 4px;font-size:40px;line-height:1;color:#fff">${rub(c.amount)}</td></tr>
<tr><td colspan="2" style="padding:0 24px 24px;font-size:13px;color:#9a9a9a">${c.expires_at ? `действует до ${date(c.expires_at)}` : ""}</td></tr>
<tr><td colspan="2" style="padding:16px 24px 22px;border-top:1px solid #2a2a2a;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:20px;letter-spacing:2px;color:#fff">${esc(formatCode(c.code))}</td></tr>
</table>`
}

const howTo = `<p style="margin:0 0 8px"><b>Как потратить</b></p>
<p style="margin:0 0 16px">На сайте — введите код при оформлении заказа в поле «Подарочная карта». В шоуруме в Омске (ул. Партизанская, 5а/8) — назовите код продавцу.
Можно тратить частями: остаток сохраняется на карте. Баланс — на странице <a href="${site()}/gift-cards" style="color:#0b0b0b">подарочных карт</a>.</p>`

/** Получателю (или покупателю, если карта для себя): карта с кодом и поздравлением */
export function giftCardMail(to: string, c: MailCard, forSelf: boolean): Mail {
  const from = !forSelf && c.buyer_name ? esc(c.buyer_name) : null
  const hello = !forSelf && c.recipient_name ? `${esc(c.recipient_name)}, ` : ""
  const intro = forSelf
    ? "Ваша подарочная карта Laflamme готова."
    : `${hello}${from ? `${from} дарит вам` : "Вам подарили"} подарочную карту Laflamme.`
  const message = c.message
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="border-left:3px solid #0b0b0b;padding:4px 0 4px 14px;font-size:15px;line-height:1.55;color:#0b0b0b;white-space:pre-line">${esc(c.message)}${from ? `<div style="margin-top:8px;font-size:13px;color:#6e6e6e">— ${from}</div>` : ""}</td></tr></table>`
    : ""
  return {
    to,
    subject: forSelf ? `Ваша подарочная карта Laflamme на ${rub(c.amount)}` : `${from ?? "Вам"} ${from ? "дарит" : "подарили"} подарочную карту Laflamme`,
    text: `${intro}\n\nНоминал: ${rub(c.amount)}\nКод: ${formatCode(c.code)}${c.expires_at ? `\nДействует до ${date(c.expires_at)}` : ""}${c.message ? `\n\n${c.message}` : ""}\n\nНа сайте — введите код при оформлении заказа в поле «Подарочная карта». В шоуруме в Омске (ул. Партизанская, 5а/8) — назовите код продавцу. Остаток сохраняется на карте.\n${site()}`,
    html: layout({
      preheader: `Подарочная карта на ${rub(c.amount)}`,
      title: forSelf ? "Ваша подарочная карта" : "Вам подарок",
      body: `<p style="margin:0 0 16px;font-size:15px;color:#0b0b0b">${intro}</p>${message}${cardBlock(c)}${howTo}`,
      button: { label: "Выбрать подарок", url: `${site()}/new` },
    }),
  }
}

/** Покупателю, если карта в подарок: оплата прошла, когда и кому придёт письмо */
export function giftCardBuyerMail(to: string, c: MailCard & { recipient_email: string; send_at: Date | string | null }): Mail {
  const when = c.send_at && new Date(c.send_at).getTime() > Date.now() + 5 * 60_000 ? date(c.send_at) : null
  const who = `${c.recipient_name ? `${esc(c.recipient_name)} (${esc(c.recipient_email)})` : esc(c.recipient_email)}`
  return {
    to,
    subject: `Подарочная карта на ${rub(c.amount)} оплачена`,
    text: `Спасибо! Подарочная карта на ${rub(c.amount)} оплачена.\n${when ? `Отправим её получателю ${c.recipient_name ?? ""} <${c.recipient_email}> ${when}.` : `Отправили её получателю ${c.recipient_name ?? ""} <${c.recipient_email}>.`}\nКод карты: ${formatCode(c.code)} — на случай, если письмо не дойдёт.`,
    html: layout({
      preheader: "Подарочная карта оплачена",
      title: "Спасибо, карта оплачена",
      body: `<p style="margin:0 0 16px">${when ? `Отправим карту получателю — ${who} — <b>${when}</b> утром.` : `Отправили карту получателю — ${who}.`}</p>
${cardBlock(c)}<p style="margin:0;color:#6e6e6e;font-size:13px">Код в этом письме — на случай, если письмо получателю не дойдёт: его можно переслать или назвать.</p>`,
    }),
  }
}
