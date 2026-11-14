import { MedusaContainer } from "@medusajs/framework/types"
import { SORT_MODULE } from "../../modules/sort"
import SortModuleService from "../../modules/sort/service"
import { allRules, isActive, ManualRule } from "./engine"

/** Ручные правила: проверка и сохранение (ТЗ сортировки, раздел 6). У каждого правила есть дата окончания */
export type RuleInput = {
  kind?: string; target_type?: string; target?: string; targets?: string[]; value?: number; listing?: string; position?: number
  starts_at?: string; ends_at?: string; note?: string
}

const DROP_HOURS = 72
const LISTING = /^[a-z0-9:/_-]{1,120}$/

export async function createRules(container: MedusaContainer, b: RuleInput, author: string, now = new Date()): Promise<number> {
  const svc: SortModuleService = container.resolve(SORT_MODULE)
  const kind = b.kind as ManualRule["kind"]
  if (!["pin", "boost", "demote", "drop", "sale"].includes(kind)) throw new Error("Неизвестный вид правила")
  const starts = b.starts_at ? new Date(b.starts_at) : now
  // Дроп — всегда на 72 часа
  const ends = kind === "drop" ? new Date(starts.getTime() + DROP_HOURS * 3_600_000) : new Date(b.ends_at ?? "")
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) throw new Error("Укажите дату окончания")
  if (ends.getTime() <= starts.getTime()) throw new Error("Дата окончания должна быть позже начала")
  const base = { starts_at: starts, ends_at: ends, author, note: String(b.note ?? "").slice(0, 200) || null }
  const targets = (b.targets?.length ? b.targets : b.target ? [b.target] : []).map((t) => String(t).trim()).filter(Boolean)

  if (kind === "sale") {
    await svc.createSortManualRules({ ...base, kind, target_type: "none", target: null, value: null, listing: null, position: null })
    return 1
  }
  if (!targets.length) throw new Error("Выберите товар, бренд или коллекцию")
  if (kind === "pin") {
    const listing = String(b.listing ?? "").trim()
    const position = Number(b.position)
    if (!LISTING.test(listing)) throw new Error("Укажите листинг")
    if (!Number.isInteger(position) || position < 1 || position > 8) throw new Error("Позиция закрепления — от 1 до 8")
    const active = (await allRules(container)).filter((r) => r.kind === "pin" && r.listing === listing && isActive(r, now))
    if (active.length + targets.length > 8) throw new Error("В одном листинге — не больше 8 закреплений")
    if (active.some((r) => r.position === position)) throw new Error(`Позиция ${position} в этом листинге уже занята`)
    await svc.createSortManualRules({ ...base, kind, target_type: "product", target: targets[0], value: null, listing, position })
    return 1
  }
  if (kind === "drop") {
    await svc.createSortManualRules(targets.slice(0, 48).map((t) => ({ ...base, kind, target_type: "product" as const, target: t, value: null, listing: null, position: null })))
    return Math.min(48, targets.length)
  }
  const type = b.target_type as ManualRule["target_type"]
  if (!["product", "brand", "collection"].includes(type)) throw new Error("Цель правила: товар, бренд или коллекция")
  const value = Number(b.value)
  if (kind === "boost" && !(value >= 1.2 && value <= 1.5)) throw new Error("Буст — от ×1.2 до ×1.5")
  if (kind === "demote" && !(value >= 0.5 && value <= 0.9)) throw new Error("Понижение — от ×0.5 до ×0.9")
  await svc.createSortManualRules(targets.map((t) => ({ ...base, kind, target_type: type, target: t, value, listing: null, position: null })))
  return targets.length
}

/** Правка действующего правила: дата окончания, множитель, позиция */
export async function updateRule(container: MedusaContainer, id: string, b: RuleInput): Promise<void> {
  const svc: SortModuleService = container.resolve(SORT_MODULE)
  const rule = await svc.retrieveSortManualRule(id).catch(() => null)
  if (!rule) throw new Error("Правило не найдено")
  const patch: Record<string, unknown> = { id }
  if (b.ends_at) {
    const ends = new Date(b.ends_at)
    if (Number.isNaN(ends.getTime())) throw new Error("Неверная дата окончания")
    patch.ends_at = ends
  }
  if (b.value !== undefined && (rule.kind === "boost" || rule.kind === "demote")) {
    const v = Number(b.value)
    if (rule.kind === "boost" ? !(v >= 1.2 && v <= 1.5) : !(v >= 0.5 && v <= 0.9)) throw new Error(rule.kind === "boost" ? "Буст — от ×1.2 до ×1.5" : "Понижение — от ×0.5 до ×0.9")
    patch.value = v
  }
  if (b.position !== undefined && rule.kind === "pin") {
    const p = Number(b.position)
    if (!Number.isInteger(p) || p < 1 || p > 8) throw new Error("Позиция закрепления — от 1 до 8")
    patch.position = p
  }
  if (b.note !== undefined) patch.note = String(b.note).slice(0, 200) || null
  await svc.updateSortManualRules(patch as never)
}

/** Завершить правило сейчас (остаётся в списке истёкших) */
export async function endRule(container: MedusaContainer, id: string): Promise<void> {
  const svc: SortModuleService = container.resolve(SORT_MODULE)
  await svc.updateSortManualRules({ id, ends_at: new Date() } as never)
}
