import { randomBytes } from "crypto"
import { MedusaContainer } from "@medusajs/framework/types"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import { MERCH_MODULE } from "../../modules/merch"
import type MerchModuleService from "../../modules/merch/service"
import { loadCatalogItems } from "../catalog/store-catalog"
import { CAT_NAME, Checklist, DEFAULT_SETTINGS, Place, Standards } from "./autofill"
import { loadMerchSettings } from "./settings"

/**
 * Задания консультантам по выкладке. Мерчендайзер собирает задание в админке из варианта расстановки,
 * консультант открывает ссылку на телефоне (/staff/merch/<token>), отмечает шаги и прикладывает фото,
 * мерчендайзер проверяет фото и оставляет замечания.
 */

export type StepProduct = { id: string; title: string; brand: string | null; cat: string | null; color: string | null; thumb: string | null; sizes: string[]; n: number; place: Place; face?: boolean }
export type Step = {
  id: string
  item_id: string
  title: string
  where: string
  render: string | null
  products: StepProduct[]
  remove: StepProduct[]
  text: string[]
  done_at: string | null
  done_by: string | null
  photos: string[]
  comment: string | null
  review: "ok" | "redo" | null
}
export type TaskRow = { id: string; layout_id: string; name: string; token: string; steps: Step[]; status: "open" | "done" | "closed"; author: string | null; note: string | null; created_at: Date; updated_at: Date }

const svc = (c: MedusaContainer) => c.resolve<MerchModuleService>(MERCH_MODULE)

export function taskUrl(token: string) {
  const base = (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/+$/, "")
  return `${base}/staff/merch/${token}`
}

const plural = (n: number, one: string, few: string, many: string) => {
  const a = n % 10, b = n % 100
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many
}

/** Какие стандарты магазина относятся к оборудованию */
export function standardsFor(type: string, products: StepProduct[], st: Standards): string[] {
  const out = [...st.all]
  if (products.some((p) => p.place === "rail")) out.push(...st.rail)
  if (products.some((p) => p.cat === "obuv")) out.push(...st.shoes)
  if (type.startsWith("table") || type === "podium") out.push(...st.table)
  else if (products.some((p) => p.place === "shelf" && p.cat !== "obuv")) out.push(...st.shelf)
  return out
}

/** Текст задания простыми словами: что убрать, что и в каком порядке повесить/выложить + стандарты магазина */
export function stepText(products: StepProduct[], remove: StepProduct[], type: string, st: Standards = DEFAULT_SETTINGS.standards): string[] {
  const out: string[] = []
  if (remove.length) out.push(`Сначала уберите на склад ${remove.length} ${plural(remove.length, "модель", "модели", "моделей")} — они отмечены ниже серым.`)
  const rail = products.filter((p) => p.place === "rail")
  const shelf = products.filter((p) => p.place === "shelf")
  if (type === "mannequin" && products.length) {
    out.push("Оденьте манекен в образ из списка: сначала низ, потом верх, верхняя одежда — последней, расстёгнутой.")
    return [...out, ...st.all]
  }
  if (rail.length) {
    const hangers = rail.reduce((a, p) => a + p.n, 0)
    out.push(`Повесьте слева направо в указанном порядке — ${rail.length} ${plural(rail.length, "модель", "модели", "моделей")}, ${hangers} ${plural(hangers, "вешалка", "вешалки", "вешалок")}.`)
    if (rail.some((p) => p.face)) out.push("Вещи с пометкой «лицом» — главные в своей группе: одну вешалку разверните лицом к покупателю (на торец или кронштейн), остальные размеры — рядом боком.")
  }
  if (shelf.length) out.push("Выложите в порядке списка: слева направо, сверху вниз.")
  return [...out, ...standardsFor(type, products, st)]
}

/** Подробности товаров (название, фото, размеры) из каталога */
export async function productInfo(c: MedusaContainer): Promise<Map<string, Omit<StepProduct, "n" | "place">>> {
  const items = await loadCatalogItems(c)
  return new Map(items.map((i) => [i.id, {
    id: i.id, title: i.title, brand: i.brand?.name ?? null, cat: i.category?.handle ?? null, color: i.color_name, thumb: i.thumbnail,
    sizes: i.sizes.filter((s) => s.in_stock).map((s) => s.size),
  }]))
}

export type StepInput = { item_id: string; type: string; title: string; where: string; render?: string | null; products: { p: string; n: number; place: Place; face?: boolean }[]; remove?: string[] }

export async function createTask(c: MedusaContainer, input: { layout_id: string; name: string; note?: string | null; steps: StepInput[] }, author: string) {
  const name = String(input.name ?? "").trim().slice(0, 120)
  if (!name) throw new Error("Укажите название задания")
  if (!Array.isArray(input.steps) || !input.steps.length) throw new Error("В задании нет шагов — разложите товары по оборудованию")
  if (input.steps.length > 300) throw new Error("Слишком много шагов")
  const [info, settings] = await Promise.all([productInfo(c), loadMerchSettings()])
  const pick = (id: string, n = 1, place: Place = "rail", face = false): StepProduct | null => {
    const p = info.get(id)
    return p ? { ...p, n, place, ...(face ? { face: true } : {}) } : null
  }
  const steps: Step[] = input.steps.map((s, i) => {
    const products = (s.products ?? []).map((x) => pick(x.p, x.n, x.place, !!x.face)).filter((x): x is StepProduct => !!x)
    const remove = (s.remove ?? []).map((id) => pick(id)).filter((x): x is StepProduct => !!x)
    const render = typeof s.render === "string" && /^https?:\/\//.test(s.render) ? s.render : null
    return {
      id: `s${i + 1}`, item_id: String(s.item_id), title: String(s.title).slice(0, 120), where: String(s.where ?? "").slice(0, 200), render,
      products, remove, text: stepText(products, remove, s.type, settings.standards), done_at: null, done_by: null, photos: [], comment: null, review: null,
    }
  })
  const row = await svc(c).createMerchTasks({ layout_id: input.layout_id, name, note: input.note ? String(input.note).slice(0, 2000) : null, token: randomBytes(18).toString("hex"), steps: steps as unknown as Record<string, unknown>, author, status: "open" })
  return row as unknown as TaskRow
}

/** Задание-чек-лист: каждый пункт — шаг с отметкой и фото */
export async function createChecklistTask(c: MedusaContainer, cl: Checklist, date: string) {
  const steps: Step[] = cl.items.map((t, i) => ({
    id: `s${i + 1}`, item_id: `check-${i + 1}`, title: t, where: "", render: null, products: [], remove: [], text: [],
    done_at: null, done_by: null, photos: [], comment: null, review: null,
  }))
  const [d, m] = [Number(date.slice(8)), Number(date.slice(5, 7))]
  const row = await svc(c).createMerchTasks({
    layout_id: `checklist:${cl.id}`, name: `${cl.name} · ${d}.${String(m).padStart(2, "0")}`, note: null, token: randomBytes(18).toString("hex"),
    steps: steps as unknown as Record<string, unknown>, author: "по расписанию", status: "open",
  })
  return row as unknown as TaskRow
}

/** Был ли уже чек-лист за эту дату (по омскому времени) */
export async function checklistSentOn(c: MedusaContainer, id: string, date: string) {
  const rows = (await svc(c).listMerchTasks({ layout_id: `checklist:${id}` }, { order: { created_at: "DESC" }, take: 1 })) as unknown as TaskRow[]
  if (!rows[0]) return false
  return new Date(new Date(rows[0].created_at).getTime() + 6 * 3600_000).toISOString().slice(0, 10) === date
}

export async function listTasks(c: MedusaContainer) {
  const rows = (await svc(c).listMerchTasks({}, { order: { created_at: "DESC" }, take: 100 })) as unknown as TaskRow[]
  return rows.map((t) => ({
    id: t.id, name: t.name, status: t.status, created_at: t.created_at, author: t.author, url: taskUrl(t.token),
    total: t.steps.length, done: t.steps.filter((s) => s.done_at).length, photos: t.steps.reduce((a, s) => a + s.photos.length, 0),
    redo: t.steps.filter((s) => s.review === "redo").length,
  }))
}

export async function getTask(c: MedusaContainer, by: { id?: string; token?: string }) {
  const filter = by.id ? { id: by.id } : { token: String(by.token ?? "") }
  if (!filter.id && !/^[a-f0-9]{36}$/.test((filter as { token: string }).token)) throw new Error("Задание не найдено")
  const [row] = (await svc(c).listMerchTasks(filter, { take: 1 })) as unknown as TaskRow[]
  if (!row) throw new Error("Задание не найдено")
  return row
}

async function saveSteps(c: MedusaContainer, t: TaskRow, steps: Step[], extra: Partial<Pick<TaskRow, "status" | "note" | "name">> = {}) {
  const allDone = steps.every((s) => s.done_at)
  const status = extra.status ?? (t.status === "closed" ? "closed" : allDone ? "done" : "open")
  await svc(c).updateMerchTasks({ id: t.id, steps: steps as unknown as Record<string, unknown>, status, ...(extra.note !== undefined ? { note: extra.note } : {}), ...(extra.name ? { name: extra.name } : {}) })
  return { ...t, steps, status, ...extra }
}

/** Консультант: отметить шаг сделанным / снять отметку */
export async function markStep(c: MedusaContainer, token: string, stepId: string, done: boolean, who: string | null) {
  const t = await getTask(c, { token })
  if (t.status === "closed") throw new Error("Задание закрыто")
  const steps = t.steps.map((s) => (s.id !== stepId ? s : {
    ...s, done_at: done ? new Date().toISOString() : null, done_by: done ? (who ? who.slice(0, 40) : null) : null,
    // Переделали после замечания — снова ждёт проверки
    review: done && s.review === "redo" ? null : s.review,
  }))
  const wasDone = t.steps.every((s) => s.done_at)
  const saved = await saveSteps(c, t, steps)
  return { task: saved, finished: !wasDone && steps.every((s) => s.done_at) }
}

/** Консультант: фото результата (JPEG, уже уменьшенное в браузере) */
export async function addPhoto(c: MedusaContainer, token: string, stepId: string, dataUrl: string) {
  const t = await getTask(c, { token })
  if (t.status === "closed") throw new Error("Задание закрыто")
  const step = t.steps.find((s) => s.id === stepId)
  if (!step) throw new Error("Шаг не найден")
  if (step.photos.length >= 6) throw new Error("К шагу можно приложить до 6 фото")
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl))
  if (!m) throw new Error("Нужна фотография")
  if (m[2].length > 6_000_000) throw new Error("Фото слишком большое")
  const url = await uploadImage(c, `merch-${t.id}-${stepId}-${Date.now()}.${m[1] === "jpeg" ? "jpg" : m[1]}`, `image/${m[1]}`, m[2])
  const steps = t.steps.map((s) => (s.id === stepId ? { ...s, photos: [...s.photos, url] } : s))
  return saveSteps(c, t, steps)
}

export async function uploadImage(c: MedusaContainer, filename: string, mimeType: string, base64: string) {
  const { result } = await uploadFilesWorkflow(c).run({ input: { files: [{ filename, mimeType, content: base64, access: "public" as const }] } })
  return result[0].url
}

/** Мерчендайзер: замечание и оценка шага, удаление фото, закрытие задания */
export async function reviewTask(c: MedusaContainer, id: string, patch: { steps?: { id: string; comment?: string | null; review?: "ok" | "redo" | null; remove_photo?: string }[]; status?: "open" | "closed"; note?: string | null; name?: string }) {
  const t = await getTask(c, { id })
  const byId = new Map((patch.steps ?? []).map((s) => [s.id, s]))
  const steps = t.steps.map((s) => {
    const p = byId.get(s.id)
    if (!p) return s
    const review = p.review === undefined ? s.review : p.review
    return {
      ...s,
      comment: p.comment === undefined ? s.comment : p.comment ? String(p.comment).slice(0, 1000) : null,
      review,
      // «Переделать» — снимаем отметку, чтобы консультант увидел шаг снова
      done_at: review === "redo" && p.review === "redo" ? null : s.done_at,
      photos: p.remove_photo ? s.photos.filter((u) => u !== p.remove_photo) : s.photos,
    }
  })
  return saveSteps(c, t, steps, { ...(patch.status ? { status: patch.status === "closed" ? "closed" : steps.every((s) => s.done_at) ? "done" : "open" } : {}), ...(patch.note !== undefined ? { note: patch.note } : {}), ...(patch.name ? { name: String(patch.name).slice(0, 120) } : {}) })
}

export async function deleteTask(c: MedusaContainer, id: string) {
  await getTask(c, { id })
  await svc(c).deleteMerchTasks(id)
}

/** Для страницы консультанта — без служебного */
export function publicTask(t: TaskRow) {
  return { name: t.name, note: t.note, status: t.status, created_at: t.created_at, steps: t.steps, cat_names: CAT_NAME }
}
