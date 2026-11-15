import { MedusaContainer } from "@medusajs/framework/types"
import { MERCH_MODULE } from "../../modules/merch"
import type MerchModuleService from "../../modules/merch/service"

/** Варианты расстановки зала. Содержимое (зал, оборудование, зоны) собирает редактор в админке; здесь — проверка и хранение */

export type LayoutRow = { id: string; name: string; data: Record<string, unknown>; is_current: boolean; author: string | null; created_at: Date; updated_at: Date }

const svc = (c: MedusaContainer) => c.resolve<MerchModuleService>(MERCH_MODULE)

/** Базовая проверка: зал с размерами, оборудование и зоны — списки, общий размер разумный */
export function validateData(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Нет данных расстановки")
  const d = data as Record<string, unknown>
  const room = d.room as Record<string, unknown> | undefined
  const num = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
  if (!room || !num(room.width, 2, 200) || !num(room.length, 2, 200) || !num(room.height, 2, 20)) throw new Error("Размеры зала: от 2 до 200 м, высота от 2 до 20 м")
  if (!Array.isArray(d.items) || d.items.length > 2000) throw new Error("Оборудование: не больше 2000 единиц")
  if (d.zones !== undefined && (!Array.isArray(d.zones) || d.zones.length > 200)) throw new Error("Зоны: не больше 200")
  if (JSON.stringify(d).length > 3_000_000) throw new Error("Расстановка слишком большая")
  return d
}

export async function listLayouts(c: MedusaContainer) {
  const rows = (await svc(c).listMerchLayouts({}, { order: { updated_at: "DESC" }, take: 200 })) as unknown as LayoutRow[]
  return rows.map(({ data, ...r }) => ({ ...r, items: Array.isArray(data?.items) ? data.items.length : 0 }))
}

export async function getLayout(c: MedusaContainer, id: string) {
  const [row] = (await svc(c).listMerchLayouts({ id }, { take: 1 })) as unknown as LayoutRow[]
  if (!row) throw new Error("Вариант не найден")
  return row
}

export async function createLayout(c: MedusaContainer, name: string, data: unknown, author: string) {
  const n = String(name ?? "").trim().slice(0, 80)
  if (!n) throw new Error("Укажите название варианта")
  const all = await listLayouts(c)
  const row = await svc(c).createMerchLayouts({ name: n, data: validateData(data), author, is_current: all.length === 0 })
  return row as unknown as LayoutRow
}

export async function updateLayout(c: MedusaContainer, id: string, patch: { name?: string; data?: unknown; is_current?: boolean }, author: string) {
  await getLayout(c, id)
  const upd: Record<string, unknown> = { id, author }
  if (patch.name !== undefined) {
    const n = String(patch.name).trim().slice(0, 80)
    if (!n) throw new Error("Укажите название варианта")
    upd.name = n
  }
  if (patch.data !== undefined) upd.data = validateData(patch.data)
  if (patch.is_current) {
    // Текущий — только один
    const others = (await listLayouts(c)).filter((l) => l.is_current && l.id !== id)
    if (others.length) await svc(c).updateMerchLayouts(others.map((o) => ({ id: o.id, is_current: false })))
    upd.is_current = true
  }
  return (await svc(c).updateMerchLayouts(upd as { id: string })) as unknown as LayoutRow
}

export async function deleteLayout(c: MedusaContainer, id: string) {
  const row = await getLayout(c, id)
  if (row.is_current) throw new Error("Это текущая расстановка магазина — сначала сделайте текущей другую")
  await svc(c).deleteMerchLayouts(id)
}
