import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type Post = { id: number; at: string; link: string | null }

const date = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })

/** «Telegram» в карточке товара: сколько раз выкладывали, ссылки на посты, кнопка «Выложить». */
const ProductTelegramWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [configured, setConfigured] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`/admin/telegram/product/${product.id}`, { credentials: "include" })
    const d = (await r.json()) as { posts: Post[]; configured: boolean }
    setPosts(d.posts ?? [])
    setConfigured(d.configured)
  }, [product.id])
  useEffect(() => { load().catch(() => setPosts([])) }, [load])

  const publish = async () => {
    if (!window.confirm(posts?.length ? "Выложить товар в канал ещё раз?" : "Выложить товар в канал?")) return
    setBusy(true)
    try {
      const r = await fetch("/admin/telegram/publish", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [product.id] }),
      })
      const d = (await r.json().catch(() => ({}))) as { message?: string; link?: string | null }
      if (!r.ok) throw new Error(d.message ?? "Не получилось")
      toast.success("Выложено в канал")
      if (d.link) window.open(d.link, "_blank", "noopener")
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (posts === null || product.status !== "published") return null
  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Telegram</Heading>
          <Text size="small" className="text-ui-fg-subtle">{posts.length ? `Выкладывали ${posts.length} раз` : "Ещё не выкладывали"}</Text>
        </div>
        <Button size="small" variant="secondary" isLoading={busy} disabled={!configured} onClick={publish}>{posts.length ? "Ещё раз" : "Выложить"}</Button>
      </div>
      {!configured && <Text size="small" className="px-6 py-3 text-ui-fg-subtle">Канал не настроен (TELEGRAM_CHANNEL_ID на сервере)</Text>}
      {posts.slice().reverse().slice(0, 5).map((p) => (
        <div key={p.id} className="flex items-center justify-between px-6 py-3">
          <Text size="small" className="text-ui-fg-subtle">{date(p.at)}</Text>
          {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-ui-fg-interactive txt-small hover:underline">Открыть пост</a>}
        </div>
      ))}
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.details.side.after" })

export default ProductTelegramWidget
