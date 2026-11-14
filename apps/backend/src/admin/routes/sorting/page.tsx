import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BarsArrowDown } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Select, Text, toast } from "@medusajs/ui"
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react"

/**
 * «Сортировка»: умная сортировка каталога (ТЗ сортировки, раздел 8). Пять экранов:
 * настройки, «Почему он здесь», предпросмотр «было / станет», ручные правила, отчёт.
 */
type Season = "winter" | "spring" | "summer" | "autumn"
type Weights = Record<"N" | "S" | "I" | "R" | "Z" | "M", number>
// Настройки — дерево чисел; правим по пути, сервер проверяет при сохранении
type Config = Record<string, any>
type Rule = { id: string; kind: "pin" | "boost" | "demote" | "drop" | "sale"; target_type: string; target: string | null; value: number | null; listing: string | null; position: number | null; starts_at: string; ends_at: string; author: string | null; note: string | null }
type State = { last_run_at: string | null; last_ok_at: string | null; error: string | null; cards: number; written: number; ms: number; profile: string | null }
type Ref = { handle: string; name: string }
type Data = {
  config: Config; version: number; versions: { version: number; author: string | null; note: string | null; created_at: string }[]
  state: State; rules: Rule[]; seasons: Record<string, { season: Season; prev: Season; t: number }>; stats_days: number; profile: string; stale: boolean
  brands: Ref[]; categories: Ref[]; titles: Record<string, string>
}
type Multiplier = { code: string; label: string; value: number }
type Row = {
  id: string; position: number; score: number; final: number; near: { b: number; c: number; t: number; p: number }
  reason: "pin" | "drop" | "quota" | "algo"; shifted?: string; relaxed?: string[]
  title: string; thumbnail: string | null; brand: string | null; color: string | null; category: string | null; price: number
  components: Weights | null; contributions: Weights | null; multipliers: Multiplier[]; k: number | null; profile: string | null; impressions_30d: number
}
type Week = { week: string; impressions: number; clicks: number; carts: number; visits: number; ctr_top: number | null; carts_per_100: number | null; coverage: number | null }

const SEASONS: Season[] = ["winter", "spring", "summer", "autumn"]
const SEASON: Record<Season, string> = { winter: "Зима", spring: "Весна", summer: "Лето", autumn: "Осень" }
const ZONE: Record<string, string> = { central: "Центральная", cold: "Холодная", south: "Южная" }
const PROFILE: Record<string, string> = { auto: "Автоматически", base: "Базовый", launch: "Запуск", season_start: "Начало сезона", season_end: "Конец сезона" }
const COMP: Record<keyof Weights, string> = { N: "Новизна", S: "Продажи", I: "Интерес", R: "Размеры", Z: "Сезон", M: "Маржа" }
const KEYS = Object.keys(COMP) as (keyof Weights)[]
const MATRIX: Record<string, string> = {
  puffers: "Пуховики, парки", light_jackets: "Лёгкие куртки, ветровки", vests: "Жилеты", knitwear: "Свитеры, трикотаж", hoodies: "Худи, свитшоты",
  longsleeves: "Лонгсливы", tees: "Футболки, поло", shirts: "Рубашки", pants: "Джинсы, брюки", shorts: "Шорты, плавки", winter_hats: "Шапки, шарфы, перчатки",
  caps: "Кепки, панамы", winter_shoes: "Зимняя обувь", sneakers: "Кроссовки", sandals: "Сланцы, сандалии", accessories: "Сумки, бельё, носки, аксессуары",
}
const WARMTH: Record<string, string> = { warm: "Утеплённая", demi: "Демисезон", light: "Лёгкая" }
const KIND: Record<Rule["kind"], string> = { pin: "Закрепление", boost: "Буст", demote: "Понижение", drop: "Дроп", sale: "Режим «Распродажа»" }
const RULE: Record<string, string> = { brand: "бренд", color: "цвет", price: "цена", model: "цвета одной модели" }
const SIZE_GROUP: Record<string, string> = { top: "Верх", bottom: "Низ", shoes: "Обувь" }

const rub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")
const f3 = (n: number | null | undefined) => (typeof n === "number" ? n.toFixed(3) : "—")

const api = async <T,>(url: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> => {
  const r = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })
  const d = (await r.json().catch(() => ({}))) as T & { message?: string }
  if (!r.ok) throw new Error(d.message ?? "Не получилось")
  return d
}

/** Число в настройках: правится как текст, в настройки уходит числом */
function Num({ value, onChange, step = 0.05, w = "w-20" }: { value: number; onChange: (v: number) => void; step?: number; w?: string }) {
  return <Input size="small" type="number" step={step} className={w} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div className="min-w-0"><Text size="small" weight="plus">{label}</Text>{hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="border-t border-ui-border-base px-6 py-4">
      <Heading level="h3" className="text-[14px]">{title}</Heading>
      {hint && <Text size="small" className="mb-2 text-ui-fg-subtle">{hint}</Text>}
      <div className="mt-2">{children}</div>
    </div>
  )
}

/** Выбор листинга: раздел (мужское, женское) + вид (всё, категория, бренд, новинки, Outlet). Ключ — как на сайте */
function ListingPicker({ value, onChange, data }: { value: string; onChange: (key: string) => void; data: Data }) {
  const parts = Object.fromEntries(value.split("/").map((p) => { const [k, v] = p.split(":"); return [k, v ?? "1"] }))
  const kind = parts.cat ? "cat" : parts.brand ? "brand" : parts.new ? "new" : parts.outlet ? "outlet" : "all"
  const build = (gender: string, k: string, v: string) => {
    const out = [gender !== "any" && `gender:${gender}`, k === "cat" && v && `cat:${v}`, k === "brand" && v && `brand:${v}`, k === "new" && "new", k === "outlet" && "outlet"].filter(Boolean)
    onChange(out.length ? out.join("/") : "all")
  }
  const gender = parts.gender ?? "any"
  const list = kind === "cat" ? data.categories : kind === "brand" ? data.brands : []
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select size="small" value={gender} onValueChange={(g) => build(g, kind, parts.cat ?? parts.brand ?? "")}>
        <Select.Trigger className="w-36"><Select.Value /></Select.Trigger>
        <Select.Content><Select.Item value="any">Все разделы</Select.Item><Select.Item value="men">Мужское</Select.Item><Select.Item value="women">Женское</Select.Item></Select.Content>
      </Select>
      <Select size="small" value={kind} onValueChange={(k) => build(gender, k, k === "cat" ? data.categories[0]?.handle ?? "" : k === "brand" ? data.brands[0]?.handle ?? "" : "")}>
        <Select.Trigger className="w-40"><Select.Value /></Select.Trigger>
        <Select.Content>
          <Select.Item value="all">Все товары раздела</Select.Item><Select.Item value="cat">Категория</Select.Item><Select.Item value="brand">Бренд</Select.Item>
          <Select.Item value="new">Новинки</Select.Item><Select.Item value="outlet">Outlet</Select.Item>
        </Select.Content>
      </Select>
      {list.length > 0 && (
        <Select size="small" value={parts.cat ?? parts.brand} onValueChange={(v) => build(gender, kind, v)}>
          <Select.Trigger className="w-56"><Select.Value /></Select.Trigger>
          <Select.Content>{list.map((x) => <Select.Item key={x.handle} value={x.handle}>{x.name}</Select.Item>)}</Select.Content>
        </Select>
      )}
    </div>
  )
}

const listingName = (key: string | null, data: Data) => {
  if (!key) return "—"
  return key.split("/").map((p) => {
    const [k, v] = p.split(":")
    if (k === "gender") return v === "men" ? "Мужское" : "Женское"
    if (k === "cat") return data.categories.find((c) => c.handle === v)?.name ?? v
    if (k === "brand") return data.brands.find((c) => c.handle === v)?.name ?? v
    return k === "new" ? "Новинки" : k === "outlet" ? "Outlet" : k === "all" ? "Вся одежда (блок «Популярное» на главной)" : p
  }).join(" · ")
}

const reasonText = (r: Row) => [
  r.reason === "pin" ? "закрепление" : r.reason === "drop" ? "дроп" : r.reason === "quota" ? "квота: мало показов" : "алгоритм",
  r.shifted && `сдвинут ограничением (${RULE[r.shifted] ?? r.shifted})`,
  r.relaxed?.length && `сняты ограничения: ${r.relaxed.map((x) => RULE[x] ?? x).join(", ")}`,
].filter(Boolean).join("; ")

// ——— Настройки ———

function SettingsTab({ data, draft, setDraft, reload, toPreview }: { data: Data; draft: Config; setDraft: (c: Config) => void; reload: () => void; toPreview: () => void }) {
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const set = (path: (string | number)[], v: unknown) => {
    const next = structuredClone(draft)
    let o = next
    for (const k of path.slice(0, -1)) o = o[k]
    o[path[path.length - 1]] = v
    setDraft(next)
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.config)
  const save = async () => {
    setBusy(true)
    try {
      await api("/admin/sort/config", { config: draft, note })
      toast.success("Настройки сохранены, баллы пересчитаны")
      setNote("")
      reload()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const rollback = async (version: number) => {
    setBusy(true)
    try { await api("/admin/sort/rollback", { version }); toast.success(`Возвращены настройки версии ${version}`); reload() } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const sum = (w: Weights) => KEYS.reduce((a, k) => a + (Number(w[k]) || 0), 0)
  const th = "px-2 py-1 text-left font-normal text-ui-fg-subtle"

  return (
    <>
      <Section title="Веса по профилям" hint={`Балл = сумма «вес × компонент». Сумма весов в каждом профиле должна быть 1. Сейчас работает профиль «${PROFILE[data.profile]}».`}>
        <Field label="Активный профиль" hint="«Автоматически»: «Запуск», пока показы собираются меньше 14 дней; «Начало» и «Конец сезона» — первые и последние 6 недель сезона; иначе «Базовый»">
          <Select size="small" value={draft.profile} onValueChange={(v) => set(["profile"], v)}>
            <Select.Trigger className="w-48"><Select.Value /></Select.Trigger>
            <Select.Content>{Object.entries(PROFILE).map(([k, v]) => <Select.Item key={k} value={k}>{v}</Select.Item>)}</Select.Content>
          </Select>
        </Field>
        <table className="mt-2 text-[13px]">
          <thead><tr><th className={th}>Профиль</th>{KEYS.map((k) => <th key={k} className={th}>{COMP[k]}</th>)}<th className={th}>Сумма</th></tr></thead>
          <tbody>
            {Object.keys(draft.profiles).map((p) => {
              const s = sum(draft.profiles[p])
              return (
                <tr key={p}>
                  <td className="px-2 py-1">{PROFILE[p]}</td>
                  {KEYS.map((k) => <td key={k} className="px-2 py-1"><Num value={draft.profiles[p][k]} onChange={(v) => set(["profiles", p, k], v)} /></td>)}
                  <td className={`px-2 py-1 ${Math.abs(s - 1) > 0.001 ? "text-ui-fg-error" : "text-ui-fg-subtle"}`}>{s.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Компоненты балла">
        <Field label="Новизна: за сколько дней балл падает в 2,7 раза" hint="exp(−дней с поступления / это число)"><Num value={draft.novelty_days} step={1} onChange={(v) => set(["novelty_days"], v)} /></Field>
        <Field label="Интерес: вес корзины относительно клика"><Num value={draft.atc_weight} step={0.1} onChange={(v) => set(["atc_weight"], v)} /></Field>
        <Field label="Интерес: сглаживание, показов" hint="Карточка с 10 показами и 2 кликами не улетает наверх: её доля подтягивается к средней по категории"><Num value={draft.smoothing} step={10} onChange={(v) => set(["smoothing"], v)} /></Field>
        <Field label="Маржа: доля маржи и доля приоритета бренда"><div className="flex gap-2"><Num value={draft.margin_weight} onChange={(v) => set(["margin_weight"], v)} /><Num value={draft.brand_weight} onChange={(v) => set(["brand_weight"], v)} /></div></Field>
      </Section>

      <Section title="Множители" hint="Перемножаются. Нет в наличии и не предзаказ — балл 0; товар без фото не показывается.">
        <Field label="В наличии один размер при сетке от стольких размеров"><div className="flex gap-2"><Num value={draft.multipliers.one_size} onChange={(v) => set(["multipliers", "one_size"], v)} /><Num value={draft.multipliers.one_size_min_grid} step={1} onChange={(v) => set(["multipliers", "one_size_min_grid"], v)} /></div></Field>
        <Field label="Предзаказ"><Num value={draft.multipliers.preorder} onChange={(v) => set(["multipliers", "preorder"], v)} /></Field>
        <Field label="Запаса хватит больше чем на N дней, карточке больше M дней" hint="Множитель, N, M"><div className="flex gap-2"><Num value={draft.multipliers.overstock} onChange={(v) => set(["multipliers", "overstock"], v)} /><Num value={draft.multipliers.overstock_days} step={1} onChange={(v) => set(["multipliers", "overstock_days"], v)} /><Num value={draft.multipliers.overstock_min_age} step={1} onChange={(v) => set(["multipliers", "overstock_min_age"], v)} /></div></Field>
        <Field label="Режим «Распродажа»: предел множителя ×(1 + скидка)"><Num value={draft.multipliers.sale_cap} onChange={(v) => set(["multipliers", "sale_cap"], v)} /></Field>
      </Section>

      <Section title="Разведение соседей" hint="Итог = балл × штраф^(сколько похожих соседей выше). Окно — сколько позиций выше смотреть.">
        <table className="text-[13px]">
          <thead><tr><th className={th}></th><th className={th}>Бренд</th><th className={th}>Цвет</th><th className={th}>Категория</th><th className={th}>Ценовой сегмент</th></tr></thead>
          <tbody>
            {(["penalties", "windows"] as const).map((g) => (
              <tr key={g}><td className="px-2 py-1">{g === "penalties" ? "Штраф" : "Окно, позиций"}</td>
                {["brand", "color", "category", "price"].map((k) => <td key={k} className="px-2 py-1"><Num value={draft[g][k]} step={g === "windows" ? 1 : 0.05} onChange={(v) => set([g, k], v)} /></td>)}</tr>
            ))}
          </tbody>
        </table>
        <Heading level="h3" className="mt-4 text-[13px]">Жёсткие ограничения</Heading>
        <Field label="Бренд: подряд не больше; не больше X из Y подряд идущих"><div className="flex gap-2"><Num value={draft.limits.brand_run} step={1} onChange={(v) => set(["limits", "brand_run"], v)} /><Num value={draft.limits.brand_in_window} step={1} onChange={(v) => set(["limits", "brand_in_window"], v)} /><Num value={draft.limits.brand_window} step={1} onChange={(v) => set(["limits", "brand_window"], v)} /></div></Field>
        <Field label="Цвет: подряд не больше; чёрных не больше X из Y"><div className="flex gap-2"><Num value={draft.limits.color_run} step={1} onChange={(v) => set(["limits", "color_run"], v)} /><Num value={draft.limits.black_in_window} step={1} onChange={(v) => set(["limits", "black_in_window"], v)} /><Num value={draft.limits.black_window} step={1} onChange={(v) => set(["limits", "black_window"], v)} /></div></Field>
        <Field label="Ценовой сегмент: подряд не больше"><Num value={draft.limits.price_run} step={1} onChange={(v) => set(["limits", "price_run"], v)} /></Field>
        <Field label="Одна модель в разных цветах: позиций между карточками"><Num value={draft.limits.model_gap} step={1} onChange={(v) => set(["limits", "model_gap"], v)} /></Field>
        <Field label="Кандидатов на каждую позицию (лучших по баллу)"><Num value={draft.candidates} step={1} onChange={(v) => set(["candidates"], v)} /></Field>
        <Field label="Квота для карточек без статистики" hint="Каждая N-я позиция до позиции M — карточке, у которой показов за 30 дней меньше K. На профиле «Запуск» выключена"><div className="flex gap-2"><Num value={draft.quota.every} step={1} onChange={(v) => set(["quota", "every"], v)} /><Num value={draft.quota.last} step={1} onChange={(v) => set(["quota", "last"], v)} /><Num value={draft.quota.max_impressions} step={10} onChange={(v) => set(["quota", "max_impressions"], v)} /></div></Field>
      </Section>

      <Section title="Календарь сезонов" hint="Начало сезона по средней полосе (спрос идёт на 3–5 недель раньше погоды). На границе веса смешиваются столько дней, сколько указано.">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          {SEASONS.map((s) => (
            <div key={s} className="flex items-center gap-2"><Text size="small" className="w-12">{SEASON[s]}</Text>
              <Num w="w-16" step={1} value={draft.calendar[s][1]} onChange={(v) => set(["calendar", s, 1], v)} /><Text size="small" className="text-ui-fg-subtle">число,</Text>
              <Num w="w-16" step={1} value={draft.calendar[s][0]} onChange={(v) => set(["calendar", s, 0], v)} /><Text size="small" className="text-ui-fg-subtle">месяц</Text></div>
          ))}
        </div>
        <Field label="Плавный переход, дней"><Num value={draft.blend_days} step={1} onChange={(v) => set(["blend_days"], v)} /></Field>
        <Heading level="h3" className="mt-3 text-[13px]">Климатические зоны: сдвиг границ, дней (минус — раньше)</Heading>
        {Object.keys(draft.zones).map((z) => (
          <Field key={z} label={ZONE[z]} hint={`Сейчас: ${SEASON[data.seasons[z].season]}${data.seasons[z].t < 1 ? `, переход с «${SEASON[data.seasons[z].prev]}» ${Math.round(data.seasons[z].t * 100)}%` : ""}`}>
            <div className="flex items-center gap-2"><Text size="xsmall" className="text-ui-fg-subtle">осень и зима</Text><Num step={1} value={draft.zones[z].cold_season} onChange={(v) => set(["zones", z, "cold_season"], v)} /><Text size="xsmall" className="text-ui-fg-subtle">весна и лето</Text><Num step={1} value={draft.zones[z].warm_season} onChange={(v) => set(["zones", z, "warm_season"], v)} /></div>
          </Field>
        ))}
      </Section>

      <Section title="Матрица сезонности" hint="Сезон = вес категории в сезоне × коэффициент коллекции, от 0.1 до 1. Если у товара указана утеплённость, вместо строки категории берётся строка утеплённости.">
        <table className="text-[13px]">
          <thead><tr><th className={th}>Категория</th>{SEASONS.map((s) => <th key={s} className={th}>{SEASON[s]}</th>)}</tr></thead>
          <tbody>
            {Object.keys(draft.matrix).map((r) => <tr key={r}><td className="px-2 py-1">{MATRIX[r] ?? r}</td>{SEASONS.map((s) => <td key={s} className="px-2 py-1"><Num value={draft.matrix[r][s]} onChange={(v) => set(["matrix", r, s], v)} /></td>)}</tr>)}
            <tr><td colSpan={5} className="px-2 pb-1 pt-4 text-ui-fg-subtle">Утеплённость (поле в карточке товара)</td></tr>
            {Object.keys(draft.warmth).map((r) => <tr key={r}><td className="px-2 py-1">{WARMTH[r] ?? r}</td>{SEASONS.map((s) => <td key={s} className="px-2 py-1"><Num value={draft.warmth[r][s]} onChange={(v) => set(["warmth", r, s], v)} /></td>)}</tr>)}
          </tbody>
        </table>
        <Heading level="h3" className="mt-4 text-[13px]">Коэффициент коллекции</Heading>
        <Field label="Текущая (FW26 зимой 2026/27)"><Num value={draft.collection.current} onChange={(v) => set(["collection", "current"], v)} /></Field>
        <Field label="Вне сезона, постоянный ассортимент"><Num value={draft.collection.none} onChange={(v) => set(["collection", "none"], v)} /></Field>
        <Field label="Прошлая того же типа (FW25 зимой 2026/27)"><Num value={draft.collection.previous} onChange={(v) => set(["collection", "previous"], v)} /></Field>
        <Field label="Противоположного типа (SS зимой)"><Num value={draft.collection.opposite} onChange={(v) => set(["collection", "opposite"], v)} /></Field>
      </Section>

      <Section title="Спрос по размерам" hint="Доля размера в продажах. «Размеры» = сумма долей размеров в наличии. Для групп без таблицы все размеры считаются равными.">
        {Object.keys(draft.size_demand).map((g) => (
          <div key={g} className="flex flex-wrap items-center gap-3 py-1"><Text size="small" className="w-12">{SIZE_GROUP[g] ?? g}</Text>
            {Object.keys(draft.size_demand[g]).map((s) => <div key={s} className="flex items-center gap-1"><Text size="xsmall" className="text-ui-fg-subtle">{s}</Text><Num w="w-16" value={draft.size_demand[g][s]} onChange={(v) => set(["size_demand", g, s], v)} /></div>)}
          </div>
        ))}
      </Section>

      <Section title="Приоритет бренда" hint="От 0 до 1, по умолчанию 0.5. Входит в компонент «Маржа».">
        <div className="grid grid-cols-2 gap-x-8 md:grid-cols-3">
          {data.brands.map((b) => (
            <div key={b.handle} className="flex items-center justify-between gap-2 py-1"><Text size="small" className="truncate">{b.name}</Text>
              <Num w="w-16" step={0.1} value={draft.brand_priority[b.handle] ?? 0.5} onChange={(v) => {
                const next = { ...draft.brand_priority }
                if (v === 0.5) delete next[b.handle]; else next[b.handle] = v
                set(["brand_priority"], next)
              }} /></div>
          ))}
        </div>
      </Section>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-ui-border-base bg-ui-bg-base px-6 py-3">
        <Input size="small" className="w-72" placeholder="Что изменили (для истории версий)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="small" disabled={!dirty} isLoading={busy} onClick={save}>Сохранить и пересчитать</Button>
        <Button size="small" variant="secondary" disabled={!dirty} onClick={toPreview}>Предпросмотр «было / станет»</Button>
        {dirty && <Button size="small" variant="transparent" onClick={() => setDraft(structuredClone(data.config))}>Отменить правки</Button>}
        <Text size="small" className="text-ui-fg-subtle">Версия {data.version || "стартовая"}</Text>
      </div>

      <Section title="История версий" hint="Каждое сохранение — новая версия. Откат возвращает настройки выбранной версии (тоже новой версией) и пересчитывает баллы.">
        {!data.versions.length && <Text size="small" className="text-ui-fg-subtle">Пока действуют стартовые настройки.</Text>}
        {data.versions.map((v) => (
          <div key={v.version} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
            <span>Версия {v.version} · {when(v.created_at)} · {v.author ?? "—"}{v.note ? ` · ${v.note}` : ""}</span>
            {v.version !== data.version && <Button size="small" variant="transparent" disabled={busy} onClick={() => rollback(v.version)}>Вернуть</Button>}
          </div>
        ))}
      </Section>
    </>
  )
}

// ——— «Почему он здесь» ———

function Thumb({ src }: { src: string | null }) {
  return src ? <img src={src} alt="" className="size-10 shrink-0 rounded bg-ui-bg-subtle object-contain" /> : <div className="size-10 shrink-0 rounded bg-ui-bg-subtle" />
}

function WhyTab({ data }: { data: Data }) {
  const [listing, setListing] = useState("all")
  const [q, setQ] = useState("")
  const [zone, setZone] = useState("central")
  const [rows, setRows] = useState<Row[] | null>(null)
  const [total, setTotal] = useState(0)
  useEffect(() => {
    setRows(null)
    const t = setTimeout(() => {
      api<{ rows: Row[]; total: number }>(`/admin/sort/why?listing=${encodeURIComponent(listing)}&zone=${zone}&q=${encodeURIComponent(q)}`)
        .then((d) => { setRows(d.rows); setTotal(d.total) }).catch((e: Error) => toast.error(e.message))
    }, 300)
    return () => clearTimeout(t)
  }, [listing, q, zone])
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
        <ListingPicker value={listing} onChange={setListing} data={data} />
        <Select size="small" value={zone} onValueChange={setZone}>
          <Select.Trigger className="w-40"><Select.Value /></Select.Trigger>
          <Select.Content>{Object.entries(ZONE).map(([k, v]) => <Select.Item key={k} value={k}>Зона: {v}</Select.Item>)}</Select.Content>
        </Select>
        <Input size="small" className="w-64" placeholder="Найти товар в листинге" value={q} onChange={(e) => setQ(e.target.value)} />
        <Text size="small" className="text-ui-fg-subtle">карточек в листинге: {total}{!q && total > 96 ? ", показаны первые 96" : ""}</Text>
      </div>
      <Text size="small" className="px-6 pb-3 text-ui-fg-subtle">Числа — из сохранённых баллов, по которым сортирует сайт. Под значением компонента — его вклад в балл (значение × вес профиля). Итог — балл после штрафов за похожих соседей.</Text>
      <div className="overflow-x-auto border-t border-ui-border-base">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-ui-fg-subtle"><th className="px-6 py-2 font-normal">Поз.</th><th className="py-2 font-normal">Товар</th>{KEYS.map((k) => <th key={k} className="px-2 py-2 font-normal">{COMP[k]}</th>)}<th className="px-2 py-2 font-normal">Множители</th><th className="px-2 py-2 font-normal">Балл</th><th className="px-2 py-2 font-normal">Итог</th><th className="px-2 py-2 pr-6 font-normal">Почему здесь</th></tr></thead>
          <tbody>
            {!rows && <tr><td colSpan={12} className="px-6 py-6 text-ui-fg-subtle">Загружаем…</td></tr>}
            {rows?.map((r) => (
              <tr key={r.id} className="border-t border-ui-border-base align-top">
                <td className="px-6 py-2">{r.position}</td>
                <td className="py-2"><div className="flex gap-3"><Thumb src={r.thumbnail} /><div className="min-w-0"><div className="max-w-[220px] truncate">{r.title}</div><div className="max-w-[220px] truncate text-ui-fg-subtle">{[r.color, r.category, rub(r.price)].filter(Boolean).join(" · ")}</div><div className="text-ui-fg-muted">показов: {r.impressions_30d}</div></div></div></td>
                {KEYS.map((k) => <td key={k} className="px-2 py-2">{r.components ? <>{r.components[k].toFixed(2)}<div className="text-ui-fg-muted">{f3(r.contributions?.[k])}</div></> : "—"}</td>)}
                <td className="px-2 py-2">{r.multipliers.length ? r.multipliers.map((m) => <div key={m.code} className="whitespace-nowrap">×{Number(m.value.toFixed(2))} <span className="text-ui-fg-subtle">{m.label}</span></div>) : <span className="text-ui-fg-muted">нет</span>}</td>
                <td className="px-2 py-2">{f3(r.score)}</td>
                <td className="px-2 py-2">{f3(r.final)}</td>
                <td className="px-2 py-2 pr-6">{reasonText(r)}{(r.near.b || r.near.c || r.near.t || r.near.p) ? <div className="text-ui-fg-muted">похожих соседей выше: {[r.near.b && `бренд ${r.near.b}`, r.near.c && `цвет ${r.near.c}`, r.near.t && `категория ${r.near.t}`, r.near.p && `цена ${r.near.p}`].filter(Boolean).join(", ")}</div> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ——— Предпросмотр ———

function PreviewTab({ data, draft }: { data: Data; draft: Config }) {
  const [listing, setListing] = useState("all")
  const [res, setRes] = useState<{ before: Row[]; after: Row[]; total: number } | null>(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.config)
  useEffect(() => {
    setRes(null)
    api<{ before: Row[]; after: Row[]; total: number }>("/admin/sort/preview", { config: draft, listing }).then(setRes).catch((e: Error) => toast.error(e.message))
  }, [listing, draft])
  const Grid = ({ rows, other }: { rows: Row[]; other?: Row[] }) => {
    const was = new Map((other ?? []).map((r) => [r.id, r.position]))
    return (
      <div className="grid grid-cols-4 gap-px bg-ui-border-base">
        {rows.map((r) => {
          const prev = was.get(r.id)
          return (
            <div key={r.id} className="bg-ui-bg-base p-2 text-[11px] leading-tight">
              {r.thumbnail ? <img src={r.thumbnail} alt="" className="aspect-[3/4] w-full bg-ui-bg-subtle object-contain" /> : <div className="aspect-[3/4] w-full bg-ui-bg-subtle" />}
              <div className="mt-1 flex justify-between gap-1"><b>{r.position}</b>{other && <span className={prev === undefined ? "text-ui-fg-interactive" : prev === r.position ? "text-ui-fg-muted" : prev > r.position ? "text-ui-tag-green-text" : "text-ui-tag-red-text"}>{prev === undefined ? "новый" : prev === r.position ? "=" : prev > r.position ? `↑${prev - r.position}` : `↓${r.position - prev}`}</span>}</div>
              <div className="truncate">{r.brand ?? "—"}</div>
              <div className="truncate text-ui-fg-subtle">{r.color ?? "—"} · {f3(r.score)}</div>
              {r.reason !== "algo" && <div className="text-ui-fg-interactive">{r.reason === "pin" ? "закреплён" : r.reason === "drop" ? "дроп" : "квота"}</div>}
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 px-6 pb-3"><ListingPicker value={listing} onChange={setListing} data={data} />
        <Text size="small" className="text-ui-fg-subtle">{dirty ? "Справа — как станет с несохранёнными правками из «Настроек»." : "Правок в настройках нет: слева и справа одно и то же. Измените что-нибудь в «Настройках» и вернитесь."}</Text></div>
      {!res ? <Text size="small" className="px-6 pb-6 text-ui-fg-subtle">Считаем…</Text> : (
        <div className="grid gap-6 border-t border-ui-border-base px-6 py-4 xl:grid-cols-2">
          <div><Heading level="h3" className="mb-2 text-[14px]">Было — первые {res.before.length} из {res.total}</Heading><Grid rows={res.before} /></div>
          <div><Heading level="h3" className="mb-2 text-[14px]">Станет</Heading><Grid rows={res.after} other={res.before} /></div>
        </div>
      )}
    </>
  )
}

// ——— Ручные правила ———

function RulesTab({ data, reload }: { data: Data; reload: () => void }) {
  const [kind, setKind] = useState<Rule["kind"]>("pin")
  const [targetType, setTargetType] = useState("product")
  const [target, setTarget] = useState("")
  const [picked, setPicked] = useState<{ id: string; title: string }[]>([])
  const [q, setQ] = useState("")
  const [found, setFound] = useState<Row[]>([])
  const [listing, setListing] = useState("all")
  const [position, setPosition] = useState(1)
  const [value, setValue] = useState(1.3)
  const [ends, setEnds] = useState(new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10))
  const [starts, setStarts] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const now = Date.now()
  const active = data.rules.filter((r) => Date.parse(r.ends_at) > now)
  const expired = data.rules.filter((r) => Date.parse(r.ends_at) <= now).slice(0, 30)
  const product = kind === "pin" || kind === "drop" || ((kind === "boost" || kind === "demote") && targetType === "product")

  useEffect(() => {
    if (!product || q.trim().length < 2) { setFound([]); return }
    const t = setTimeout(() => { api<{ rows: Row[] }>(`/admin/sort/why?listing=all&take=8&q=${encodeURIComponent(q)}`).then((d) => setFound(d.rows)).catch(() => null) }, 300)
    return () => clearTimeout(t)
  }, [q, product])
  useEffect(() => { setValue(kind === "demote" ? 0.7 : 1.3); setPicked([]) }, [kind])

  const create = async () => {
    setBusy(true)
    try {
      const targets = product ? picked.map((p) => p.id) : [target.trim()]
      await api("/admin/sort/rules", {
        kind, target_type: kind === "sale" ? "none" : product ? "product" : targetType, targets, value, listing, position,
        starts_at: starts ? `${starts}T00:00:00+06:00` : undefined, ends_at: `${ends}T23:59:59+06:00`, note,
      })
      toast.success("Правило создано")
      setPicked([]); setQ(""); setNote("")
      reload()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const end = async (id: string) => {
    try { await api(`/admin/sort/rules/${id}`, undefined, "DELETE"); toast.success("Правило завершено"); reload() } catch (e) { toast.error((e as Error).message) }
  }
  const targetName = (r: Rule) => r.target_type === "product" ? data.titles[r.target ?? ""] ?? "товар снят с сайта" : r.target_type === "brand" ? `бренд ${data.brands.find((b) => b.handle === r.target)?.name ?? r.target}` : r.target_type === "collection" ? `коллекция ${r.target}` : ""
  const describe = (r: Rule) => [KIND[r.kind], targetName(r), r.kind === "pin" && `${listingName(r.listing, data)}, позиция ${r.position}`, r.value && `×${r.value}`].filter(Boolean).join(" · ")
  const List = ({ rules, canEnd }: { rules: Rule[]; canEnd?: boolean }) => (
    <>
      {rules.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-3 border-t border-ui-border-base px-6 py-2 text-[13px]">
          <div className="min-w-0"><div className="truncate">{describe(r)}</div><div className="text-ui-fg-subtle">{Date.parse(r.starts_at) > now ? `начнётся ${when(r.starts_at)}, ` : ""}до {when(r.ends_at)} · {r.author ?? "—"}{r.note ? ` · ${r.note}` : ""}</div></div>
          {canEnd && <Button size="small" variant="transparent" onClick={() => end(r.id)}>Завершить</Button>}
        </div>
      ))}
    </>
  )

  return (
    <>
      <Section title="Новое правило" hint="Ручные правила сильнее алгоритма и всегда имеют дату окончания. Закреплений — не больше 8 на листинг. Дроп закрепляет новое поступление наверху «Новинок» и страницы бренда на 72 часа.">
        <div className="flex flex-wrap items-end gap-3">
          <div><Label size="xsmall">Правило</Label>
            <Select size="small" value={kind} onValueChange={(v) => setKind(v as Rule["kind"])}>
              <Select.Trigger className="w-52"><Select.Value /></Select.Trigger>
              <Select.Content>{Object.entries(KIND).map(([k, v]) => <Select.Item key={k} value={k}>{v}</Select.Item>)}</Select.Content>
            </Select></div>
          {(kind === "boost" || kind === "demote") && (
            <>
              <div><Label size="xsmall">Цель</Label>
                <Select size="small" value={targetType} onValueChange={(v) => { setTargetType(v); setTarget(v === "brand" ? data.brands[0]?.handle ?? "" : "") }}>
                  <Select.Trigger className="w-36"><Select.Value /></Select.Trigger>
                  <Select.Content><Select.Item value="product">Товар</Select.Item><Select.Item value="brand">Бренд</Select.Item><Select.Item value="collection">Коллекция</Select.Item></Select.Content>
                </Select></div>
              {targetType === "brand" && <div><Label size="xsmall">Бренд</Label>
                <Select size="small" value={target} onValueChange={setTarget}><Select.Trigger className="w-52"><Select.Value /></Select.Trigger>
                  <Select.Content>{data.brands.map((b) => <Select.Item key={b.handle} value={b.handle}>{b.name}</Select.Item>)}</Select.Content></Select></div>}
              {targetType === "collection" && <div><Label size="xsmall">Коллекция</Label><Input size="small" className="w-28" placeholder="FW26" value={target} onChange={(e) => setTarget(e.target.value)} /></div>}
              <div><Label size="xsmall">Множитель ({kind === "boost" ? "1.2–1.5" : "0.5–0.9"})</Label><div><Num value={value} onChange={setValue} /></div></div>
            </>
          )}
          {kind === "pin" && <><div><Label size="xsmall">Листинг</Label><ListingPicker value={listing} onChange={setListing} data={data} /></div><div><Label size="xsmall">Позиция (1–8)</Label><div><Num step={1} value={position} onChange={setPosition} /></div></div></>}
          {kind === "sale" && <div><Label size="xsmall">Начало (пусто — сейчас)</Label><Input size="small" type="date" value={starts} onChange={(e) => setStarts(e.target.value)} /></div>}
          {kind !== "drop" && <div><Label size="xsmall">Действует до</Label><Input size="small" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} /></div>}
          <div><Label size="xsmall">Заметка</Label><Input size="small" className="w-56" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <Button size="small" isLoading={busy} disabled={product ? !picked.length : kind !== "sale" && !target.trim()} onClick={create}>Создать</Button>
        </div>
        {product && (
          <div className="mt-3">
            <Input size="small" className="w-96" placeholder={kind === "drop" ? "Найти товары дропа по названию" : "Найти товар по названию"} value={q} onChange={(e) => setQ(e.target.value)} />
            {found.map((r) => (
              <button key={r.id} type="button" className="mt-1 flex w-full max-w-xl items-center gap-3 rounded px-2 py-1 text-left text-[13px] hover:bg-ui-bg-base-hover"
                onClick={() => setPicked((p) => (kind === "drop" ? (p.some((x) => x.id === r.id) ? p : [...p, { id: r.id, title: r.title }]) : [{ id: r.id, title: r.title }]))}>
                <Thumb src={r.thumbnail} /><span className="truncate">{r.title}</span>
              </button>
            ))}
            {picked.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{picked.map((p) => <Badge key={p.id} size="2xsmall" className="cursor-pointer" onClick={() => setPicked((x) => x.filter((y) => y.id !== p.id))}>{p.title} ✕</Badge>)}</div>}
          </div>
        )}
        {kind === "sale" && <Text size="small" className="mt-2 text-ui-fg-subtle">Пока режим включён, балл уценённых товаров умножается на (1 + скидка), но не больше предела из настроек. В обычное время скидка на балл не влияет.</Text>}
      </Section>
      <div className="border-t border-ui-border-base px-6 py-3"><Heading level="h3" className="text-[14px]">Действуют и запланированы: {active.length}</Heading></div>
      <List rules={active} canEnd />
      {expired.length > 0 && <><div className="border-t border-ui-border-base px-6 py-3"><Heading level="h3" className="text-[14px] text-ui-fg-subtle">Истёкшие</Heading></div><List rules={expired} /></>}
    </>
  )
}

// ——— Отчёт ———

function ReportTab() {
  const [rep, setRep] = useState<{ weeks: Week[]; top_brand: { brand: string | null; share: number } | null; cards: number } | null>(null)
  useEffect(() => { api<typeof rep>("/admin/sort/report").then(setRep).catch((e: Error) => toast.error(e.message)) }, [])
  if (!rep) return <Text size="small" className="px-6 pb-6 text-ui-fg-subtle">Загружаем…</Text>
  const v = (n: number | null, unit = "") => (n === null ? "—" : `${n}${unit}`)
  return (
    <>
      <Text size="small" className="px-6 pb-3 text-ui-fg-subtle">
        События собирает сам сайт: показ — карточка на экране не меньше чем наполовину в течение секунды, клик — переход из листинга, корзина — добавление после клика.
        Доля самого частого бренда в первых 24 позициях всего каталога сейчас: {rep.top_brand ? `${rep.top_brand.brand ?? "без бренда"} — ${rep.top_brand.share}%` : "—"}. Карточек в каталоге: {rep.cards}.
      </Text>
      <div className="overflow-x-auto border-t border-ui-border-base">
        <table className="w-full text-[13px]">
          <thead><tr className="text-left text-ui-fg-subtle">{["Неделя с", "Визиты листингов", "Показы", "Клики", "Корзины", "CTR первой страницы", "Корзин на 100 визитов", "Охват каталога"].map((h) => <th key={h} className="px-6 py-2 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {!rep.weeks.length && <tr><td colSpan={8} className="px-6 py-6 text-ui-fg-subtle">Событий пока нет: статистика начнёт копиться после выкладки на сайт.</td></tr>}
            {rep.weeks.map((w) => (
              <tr key={w.week} className="border-t border-ui-border-base">
                <td className="px-6 py-2">{new Date(w.week).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</td><td className="px-6 py-2">{w.visits}</td><td className="px-6 py-2">{w.impressions}</td><td className="px-6 py-2">{w.clicks}</td><td className="px-6 py-2">{w.carts}</td>
                <td className="px-6 py-2">{v(w.ctr_top, "%")}</td><td className="px-6 py-2">{v(w.carts_per_100)}</td><td className="px-6 py-2">{v(w.coverage, "%")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ——— Страница ———

const TABS = [["settings", "Настройки"], ["why", "Почему он здесь"], ["preview", "Предпросмотр"], ["rules", "Ручные правила"], ["report", "Отчёт"]] as const
type Tab = (typeof TABS)[number][0]

const SortingPage = () => {
  const [data, setData] = useState<Data | null>(null)
  const [draft, setDraft] = useState<Config | null>(null)
  const [tab, setTab] = useState<Tab>("settings")
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const d = await api<Data>("/admin/sort")
    setData(d)
    setDraft(structuredClone(d.config))
  }, [])
  useEffect(() => { load().catch((e: Error) => toast.error(e.message)) }, [load])
  const recompute = async () => {
    setBusy(true)
    try {
      const r = await api<{ state: State }>("/admin/sort/recompute", { with_ms: true })
      toast.success(`Пересчитано карточек: ${r.state.cards}`)
      await load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const season = useMemo(() => (data ? data.seasons.central : null), [data])

  if (!data || !draft) return <Container className="p-6"><Text className="text-ui-fg-subtle">Загружаем…</Text></Container>
  return (
    <Container className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-4">
        <div>
          <Heading level="h1">Сортировка каталога</Heading>
          <Text size="small" className="mt-1 max-w-3xl text-ui-fg-subtle">
            Порядок товаров по умолчанию на сайте: балл карточки (новизна, продажи, интерес, размеры, сезон, маржа), разведение соседей (бренды, цвета и цены чередуются) и ручные правила.
          </Text>
          <Text size="small" className="mt-2">
            Профиль: <b>{PROFILE[data.profile]}</b> · сезон: <b>{season ? SEASON[season.season] : "—"}</b>{season && season.t < 1 ? ` (переход ${Math.round(season.t * 100)}%)` : ""} · статистика показов: {data.stats_days} дн. ·
            последний пересчёт: {when(data.state.last_ok_at)}, карточек {data.state.cards}
          </Text>
          {(data.stale || data.state.error) && (
            <Text size="small" className="mt-1 text-ui-fg-error">
              {data.state.error ? `Последний пересчёт не выполнен: ${data.state.error}. ` : ""}{data.stale ? "Баллы не обновлялись больше суток — сайт работает на прежних. Нажмите «Пересчитать сейчас»." : ""}
            </Text>
          )}
        </div>
        <Button size="small" variant="secondary" isLoading={busy} onClick={recompute}>Пересчитать сейчас</Button>
      </div>
      <div className="flex flex-wrap gap-1 px-6 pb-4">
        {TABS.map(([k, label]) => <Button key={k} size="small" variant={tab === k ? "primary" : "transparent"} onClick={() => setTab(k)}>{label}</Button>)}
      </div>
      {tab === "settings" && <SettingsTab data={data} draft={draft} setDraft={setDraft} reload={load} toPreview={() => setTab("preview")} />}
      {tab === "why" && <WhyTab data={data} />}
      {tab === "preview" && <PreviewTab data={data} draft={draft} />}
      {tab === "rules" && <RulesTab data={data} reload={load} />}
      {tab === "report" && <ReportTab />}
    </Container>
  )
}

export const config = defineRouteConfig({ label: "Сортировка", icon: BarsArrowDown })

export default SortingPage
