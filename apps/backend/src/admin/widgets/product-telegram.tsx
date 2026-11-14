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
  // Фото для постов: все фото товара и выбранные по порядку (пусто — все подряд, как на сайте)
  const [images, setImages] = useState<string[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])

  const load = useCallback(async () => {
    const r = await fetch(`/admin/telegram/product/${product.id}`, { credentials: "include" })
    const d = (await r.json()) as { nets?: Record<Net, NetData>; posts: Post[]; configured: boolean; images?: string[]; photos?: string[] }
    setImages(d.images ?? [])
    setPicked(d.photos ?? [])
    setSaved(d.photos ?? [])
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

  const toggle = (url: string) => setPicked((p) => (p.includes(url) ? p.filter((x) => x !== url) : p.length >= 10 ? p : [...p, url]))
  const savePhotos = (photos: string[]) => run("photos", async () => {
    await call(`/admin/telegram/product/${product.id}`, { photos })
    toast.success(photos.length ? `Фото для постов сохранены: ${photos.length}` : "Фото для постов — все подряд, как на сайте")
  })
  const changed = picked.join("|") !== saved.join("|")

  if (nets === null || product.status !== "published") return null
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4"><Heading level="h2">Соцсети</Heading></div>
      {images.length > 1 && (
        <div className="px-6 py-3">
          <Text size="small" weight="plus">Фото в посте</Text>
          <Text size="xsmall" className="mb-2 text-ui-fg-subtle">
            {picked.length
              ? `Выбрано ${picked.length}: в пост пойдут только они, в этом порядке. Нажмите на фото, чтобы убрать.`
              : "Нажимайте на фото по порядку, в каком они должны идти в посте (до 10). Не выбрано — все фото подряд, как на сайте."}
          </Text>
          <div className="grid grid-cols-4 gap-1.5">
            {images.map((url) => {
              const n = picked.indexOf(url)
              return (
                <button key={url} type="button" onClick={() => toggle(url)}
                  className={`relative aspect-[3/4] overflow-hidden rounded-md border-2 bg-ui-bg-subtle ${n >= 0 ? "border-ui-fg-interactive" : "border-transparent opacity-60 hover:opacity-100"}`}>
                  <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  {n >= 0 && <span className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-ui-fg-interactive text-[11px] font-medium text-white">{n + 1}</span>}
                </button>
              )
            })}
          </div>
          {(changed || saved.length > 0) && (
            <div className="mt-2 flex gap-1">
              {changed && <Button size="small" isLoading={busy === "photos"} disabled={!!busy} onClick={() => savePhotos(picked)}>Сохранить</Button>}
              {changed && <Button size="small" variant="transparent" disabled={!!busy} onClick={() => setPicked(saved)}>Отменить</Button>}
              {!changed && saved.length > 0 && <Button size="small" variant="transparent" disabled={!!busy} onClick={() => { setPicked([]); savePhotos([]) }}>Сбросить — все подряд</Button>}
            </div>
          )}
        </div>
      )}
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
