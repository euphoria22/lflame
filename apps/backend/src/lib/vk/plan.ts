import { MedusaContainer } from "@medusajs/framework/types"
import { loadCatalogItems } from "../catalog/store-catalog"
import { site } from "../notify/templates"
import {
  contact, PlannedPost, postFiles, postProduct, promoPrices, readMeta, readQueue, saveTg, telegramOverview, TgQueueState, updateQueue,
} from "../telegram/channel"
import { postState, tgMetaOf } from "../telegram/post"
import { nextSlots } from "../telegram/schedule"
import { ensureVkGroupId, uploadWallPhotos, vkApi, vkConfigured } from "./client"
import { buildVkText } from "./post"

/**
 * ВКонтакте: посты выходят отложенными записями сообщества (видны в «Отложенных записях», можно поправить вручную).
 * Раз в 10 минут:
 *  1) сверяемся с ВКонтакте: вышедшие записи — в историю товара (больше их не трогаем), удалённые вручную — забываем;
 *  2) ещё не вышедшие: товар закончился или снят с сайта — запись удаляем (слот займёт другой товар);
 *     изменилась цена, размеры или акция — обновляем текст (подписчики его ещё не видели);
 *  3) заполняем свободные слоты расписания на horizon_days дней вперёд: сначала очередь, потом рекомендации (если включены).
 */
type Logger = { info: (m: string) => void; warn: (m: string) => void }
type VkWallItem = { id: number; date: number; text?: string; postponed_id?: number }

const MIN = 60_000
/** Не ставим запись ближе чем через 15 минут: ВКонтакте требует время в будущем */
const LEAD = 15 * MIN
/** Сколько новых записей создаём за один проход (загрузка фото небыстрая) */
const MAX_NEW = 6
/** Убранный вручную товар не предлагаем столько дней */
const SKIP_DAYS = 14

const sameSlot = (a: number, b: number) => Math.abs(a - b) < 2 * MIN
let running = false

export async function vkPlanTick(container: MedusaContainer, log: Logger, now = new Date()): Promise<{ created: number; removed: number; edited: number; published: number } | null> {
  if (running || !vkConfigured()) return null
  running = true
  const stats = { created: 0, removed: 0, edited: 0, published: 0 }
  try {
    const group = await ensureVkGroupId()
    const owner = `-${group}`
    let q = await readQueue(container, "vk")
    const planned: PlannedPost[] = [...(q.planned ?? [])]

    // 1) Что сейчас лежит в отложенных записях ВКонтакте
    const postponed = await vkApi<{ items: VkWallItem[] }>("wall.get", { owner_id: owner, filter: "postponed", count: 100 })
    const inVk = new Map(postponed.items.map((i) => [i.id, i]))
    const keep: PlannedPost[] = []
    let recent: VkWallItem[] | null = null
    for (const p of planned) {
      const v = inVk.get(p.post_id)
      if (v) {
        // Время поменяли вручную во ВКонтакте — запоминаем новое
        keep.push({ ...p, at: new Date(v.date * 1000).toISOString() })
        continue
      }
      if (Date.parse(p.at) <= now.getTime() + MIN) {
        // Вышла — в историю товара. Номер опубликованной записи ищем на стене по времени
        recent ??= (await vkApi<{ items: VkWallItem[] }>("wall.get", { owner_id: owner, count: 40 })).items
        const hit = recent.find((i) => i.postponed_id === p.post_id) ?? recent.find((i) => Math.abs(i.date * 1000 - Date.parse(p.at)) < 10 * MIN)
        const row = await readMeta(container, p.product_id)
        if (row) {
          const vk = tgMetaOf(row.metadata, "vk")
          await saveTg(container, p.product_id, { posts: [...vk.posts, { id: hit?.id ?? p.post_id, at: p.at }], state: vk.state }, "vk")
        }
        stats.published++
      }
      // Иначе удалили вручную — просто забываем
    }

    // 2) Ещё не вышедшие: проверка наличия и цены
    const items = new Map((await loadCatalogItems(container)).map((i) => [i.id, i]))
    const promos = await promoPrices(container, keep.map((p) => items.get(p.product_id)).filter((i): i is NonNullable<typeof i> => Boolean(i)))
    const alive: PlannedPost[] = []
    for (const p of keep) {
      const item = items.get(p.product_id)
      if (!item || (!item.in_stock && !item.preorder)) {
        await vkApi("wall.delete", { owner_id: owner, post_id: p.post_id }).catch((e: Error) => log.warn(`ВКонтакте: отложенная запись ${p.post_id} не удалена: ${e.message}`))
        stats.removed++
        continue
      }
      const state = postState({ ...item, promo: promos.get(item.id) ?? null })
      if (state !== p.state) {
        const product = await postProduct(container, item.handle)
        if (product) {
          try {
            await vkApi("wall.edit", {
              owner_id: owner, post_id: p.post_id, message: buildVkText(product, { site: site(), contact: contact() }),
              attachments: p.att, publish_date: Math.floor(Date.parse(p.at) / 1000),
            })
            stats.edited++
            alive.push({ ...p, state })
            continue
          } catch (e) {
            log.warn(`ВКонтакте: отложенная запись ${p.post_id} не обновлена: ${(e as Error).message}`)
          }
        }
      }
      alive.push(p)
    }

    // 3) Свободные слоты на horizon_days вперёд
    const horizon = now.getTime() + (q.horizon_days ?? 7) * 1440 * MIN
    const slots = q.schedule.enabled
      ? nextSlots(q.schedule, new Date(now.getTime() + LEAD), 24 * 60 / Math.max(q.schedule.every, 5) * ((q.horizon_days ?? 7) + 1))
        .filter((d) => d.getTime() <= horizon)
        .filter((d) => !alive.some((p) => sameSlot(Date.parse(p.at), d.getTime())))
      : []
    const used = new Set(alive.map((p) => p.product_id))
    const skip = Object.fromEntries(Object.entries(q.skip ?? {}).filter(([, until]) => Date.parse(until) > now.getTime()))
    const manual = q.items.filter((id) => !used.has(id))
    let recs: string[] | null = null
    const takenFromQueue: string[] = []
    let error: string | null = null
    for (const slot of slots) {
      if (stats.created >= MAX_NEW) break
      let id: string | undefined
      let auto = false
      while (!id && manual.length) {
        const m = manual.shift()!
        const it = items.get(m)
        takenFromQueue.push(m)
        if (it && (it.in_stock || it.preorder)) id = m
      }
      if (!id && q.schedule.auto) {
        recs ??= (await telegramOverview(container, "vk")).rows
          .filter((r) => r.recommendation)
          .sort((a, b) => a.recommendation!.order! - b.recommendation!.order!)
          .map((r) => r.id)
        id = recs.find((r) => !used.has(r) && !skip[r])
        auto = true
      }
      if (!id) break
      used.add(id)
      try {
        alive.push(await createPostponed(container, id, owner, slot, auto))
        stats.created++
      } catch (e) {
        error = `${new Date().toLocaleString("ru-RU", { timeZone: q.schedule.tz })}: ${(e as Error).message}`
        log.warn(`ВКонтакте: товар ${id} не поставлен в отложку: ${(e as Error).message}`)
      }
    }

    q = await updateQueue(container, (cur) => ({
      ...cur,
      items: cur.items.filter((x) => !takenFromQueue.includes(x)),
      planned: alive.sort((a, b) => a.at.localeCompare(b.at)),
      skip,
      last_at: stats.published ? now.toISOString() : cur.last_at,
      last_error: error ?? cur.last_error,
    }), "vk")
    if (stats.created || stats.removed || stats.edited || stats.published) log.info(`ВКонтакте: отложка ${JSON.stringify(stats)}`)
    return stats
  } finally {
    running = false
  }
}

async function createPostponed(container: MedusaContainer, productId: string, owner: string, slot: Date, auto: boolean): Promise<PlannedPost> {
  const row = await readMeta(container, productId)
  if (!row) throw new Error("Товар не найден")
  const p = await postProduct(container, row.handle)
  if (!p) throw new Error("Товар не опубликован на сайте")
  if (!p.images.length) throw new Error("У товара нет фото")
  const files = await postFiles(p.images)
  const att = (await uploadWallPhotos(files)).join(",")
  if (!att) throw new Error("ВКонтакте не принял фото")
  const r = await vkApi<{ post_id: number }>("wall.post", {
    owner_id: owner, from_group: 1, message: buildVkText(p, { site: site(), contact: contact() }), attachments: att,
    publish_date: Math.floor(slot.getTime() / 1000),
  })
  return { product_id: productId, post_id: r.post_id, at: slot.toISOString(), state: postState(p), att, auto }
}

/** Убрать отложенную запись (кнопка в админке). Товар из рекомендаций не предлагаем SKIP_DAYS дней; слот займёт следующий */
export async function removePlanned(container: MedusaContainer, postId: number): Promise<TgQueueState> {
  const group = await ensureVkGroupId()
  const q = await readQueue(container, "vk")
  const p = (q.planned ?? []).find((x) => x.post_id === postId)
  await vkApi("wall.delete", { owner_id: `-${group}`, post_id: postId }).catch(() => null)
  return updateQueue(container, (cur) => ({
    ...cur,
    planned: (cur.planned ?? []).filter((x) => x.post_id !== postId),
    skip: p ? { ...(cur.skip ?? {}), [p.product_id]: new Date(Date.now() + SKIP_DAYS * 86_400_000).toISOString() } : cur.skip,
  }), "vk")
}
