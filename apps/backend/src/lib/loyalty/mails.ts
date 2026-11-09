import { Mail } from "../notify/mailer"
import { layout, rub, site } from "../notify/templates"
import { Tier } from "./rules"

/** Письмо о новом уровне (ТЗ, п. 6.7). */
export function loyaltyLevelMail(to: string, tier: Tier): Mail {
  const text = `Ваш уровень в программе LAFLAMME — ${tier.name}: скидка ${tier.discount}% на покупки онлайн и в магазине, со следующей покупки.`
  return {
    to,
    subject: `Ваш новый уровень LAFLAMME — ${tier.name}`,
    text: `${text}\n\nЛичный кабинет: ${site()}/account`,
    html: layout({ preheader: text, title: `Новый уровень — ${tier.name}`, body: `${text}<br><br>Скидка применяется сама, когда вы вошли в аккаунт. В магазине назовите номер телефона.`, button: { label: "Мой уровень", url: `${site()}/account` } }),
  }
}

/** Предупреждение о понижении уровня. */
export function loyaltyDropMail(to: string, tier: Tier, need: number, until: Date): Mail {
  const date = until.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
  const text = `Сохраните уровень ${tier.name}: купите на ${rub(need)} до ${date}. Иначе часть покупок выйдет за 12 месяцев и уровень понизится.`
  return {
    to,
    subject: `Сохраните уровень ${tier.name}`,
    text: `${text}\n\n${site()}/new`,
    html: layout({ preheader: text, title: `Сохраните уровень ${tier.name}`, body: text, button: { label: "Смотреть новинки", url: `${site()}/new` } }),
  }
}
