import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type Net = "tg" | "vk"
type Post = { id: number; at: string; link: string | null }
type NetData = { configured: boolean; posts: Post[] }

const NET_NAME: Record<Net, string> = { tg: "Telegram", vk: "ВКонтакте" }
const date = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })

/** «Соцсети» в карточке товара: Telegram и ВКонтакте — сколько раз выкладывали, ссылки на посты, «В очередь» и «Сейчас». */
const ProductTelegramWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const [nets, setNets] = useState<Record<Net, NetData> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/admin/telegram/product/${product.id}`, { credentials: "include" })
    const d = (await r.json()) as { nets?: Record<Net, NetData>; posts: Post[]; configured: boolean }
    setNets(d.nets ?? { tg: { configured: d.configured, posts: d.posts ?? [] }, vk: { configured: false, posts: [] } })
  }, [product.id])
  useEffect(() => { load().catch(() => setNets({ tg: { configured: false, posts: [] }, vk: { configured: false, posts: [] } })) }, [load])

  const call = async (url: string, body: unknown) => {
    const r = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const d = (await r.json().catch(() => ({}))) as { message?: string; link?: string | null }
    if (!r.ok) throw new Error(d.message ?? "Не получилось")
    return d
  }
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try { await fn(); await load() } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }
  const publishNow = (net: Net) => {
    if (!window.confirm(`Выложить товар в ${net === "vk" ? "сообщество ВКонтакте" : "Telegram-канал"} прямо сейчас, вне расписания?`)) return
    run(`now-${net}`, async () => {
      const d = await call("/admin/telegram/publish", { id: product.id, net })
      toast.success(`Выложено: ${NET_NAME[net]}`)
      if (d.link) window.open(d.link, "_blank", "noopener")
    })
  }
  const enqueue = (net: Net) => run(`q-${net}`, async () => {
    await call("/admin/telegram/queue", { add: [product.id], net })
    toast.success(`Добавлено в очередь ${NET_NAME[net]} — выйдет по расписанию (раздел «Соцсети»)`)
  })

  if (nets === null || product.status !== "published") return null
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4"><Heading level="h2">Соцсети</Heading></div>
      {(["tg", "vk"] as Net[]).map((net) => {
        const n = nets[net]
        return (
          <div key={net} className="px-6 py-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Text size="small" weight="plus">{NET_NAME[net]}</Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {!n.configured ? "не настроен на сервере" : n.posts.length ? `выкладывали ${n.posts.length} раз, последний — ${date(n.posts[n.posts.length - 1].at)}` : "ещё не выкладывали"}
                </Text>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="small" variant="secondary" disabled={!n.configured || Boolean(busy)} isLoading={busy === `q-${net}`} onClick={() => enqueue(net)}>В очередь</Button>
                <Button size="small" variant="transparent" disabled={!n.configured || Boolean(busy)} isLoading={busy === `now-${net}`} onClick={() => publishNow(net)}>Сейчас</Button>
              </div>
            </div>
            {n.posts.slice().reverse().slice(0, 3).map((p) => p.link && (
              <a key={p.id} href={p.link} target="_blank" rel="noopener noreferrer" className="mt-1 block text-ui-fg-interactive txt-small hover:underline">Пост от {date(p.at)}</a>
            ))}
          </div>
        )
      })}
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.details.side.after" })

export default ProductTelegramWidget
