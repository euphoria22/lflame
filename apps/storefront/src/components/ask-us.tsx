import { SUPPORT } from "@/lib/site"
import { TelegramIcon, VkIcon } from "./icons"

/**
 * «Остались вопросы?» — Telegram и ВКонтакте поддержки. В Telegram сразу подставляется текст
 * с товаром, чтобы покупателю не объяснять, о чём речь.
 */
export function AskUs({ message, compact = false, className = "" }: { message?: string; compact?: boolean; className?: string }) {
  const tg = message ? `${SUPPORT.telegram}?text=${encodeURIComponent(message)}` : SUPPORT.telegram
  const link = "inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] transition-colors hover:border-foreground"
  if (compact) {
    return (
      <p className={`text-center text-[12px] text-muted ${className}`}>
        Вопросы? Напишите в{" "}
        <a href={tg} target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-foreground">Telegram</a> или{" "}
        <a href={SUPPORT.vk} target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-foreground">ВКонтакте</a>
      </p>
    )
  }
  return (
    <div className={className}>
      <p className="text-[13px] text-muted">Остались вопросы по размеру или товару? Ответим в мессенджере.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={tg} target="_blank" rel="noopener" className={link}><TelegramIcon className="size-4" />Telegram</a>
        <a href={SUPPORT.vk} target="_blank" rel="noopener" className={link}><VkIcon className="size-4" />ВКонтакте</a>
      </div>
    </div>
  )
}
