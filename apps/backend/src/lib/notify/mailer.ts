import nodemailer, { Transporter } from "nodemailer"

/**
 * Отправка писем через SMTP (Яндекс 360, Unisender, Mail.ru для бизнеса и т.п.).
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM — в .env. Beget: smtp.beget.com, порт 2525
 * (с сервера в Docker порт 465 у Beget зависает, 2525 со STARTTLS работает).
 * Без SMTP_HOST письма не отправляются, а печатаются в журнал сервера (для разработки).
 */
let transporter: Transporter | null = null

export function mailEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST)
}

function getTransport(): Transporter {
  if (transporter) return transporter
  const port = Number(process.env.SMTP_PORT || 465)
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    // На других портах (587, 2525) — обязательный STARTTLS: пароль и письма не уходят открытым текстом
    requireTLS: port !== 465,
    // Почтовый сервер не отвечает — не держим покупателя 2 минуты (значение библиотеки по умолчанию)
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  })
  return transporter
}

export type Mail = { to: string; subject: string; html: string; text: string }

export async function sendMail(mail: Mail, log: { info: (m: string) => void } = console): Promise<void> {
  if (!mailEnabled()) {
    log.info(`[письмо не отправлено — SMTP не настроен] Кому: ${mail.to} | ${mail.subject}\n${mail.text}`)
    return
  }
  await getTransport().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, ...mail })
}
