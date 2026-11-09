import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Plus, RocketLaunch, Trash } from "@medusajs/icons"
import { Badge, Button, Checkbox, Container, Heading, IconButton, Input, Label, Select, Switch, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

type WeightRule = { keywords: string; weight: number }
type Parcel = {
  box_length: number
  box_width: number
  height_per_item: number
  min_height: number
  max_height: number
  fallback_weight: number
  weights: WeightRule[]
}
type Settings = {
  free_shipping_from: number
  cdek_shipment_point: string
  cdek_tariff_pvz: number
  cdek_tariff_door: number
  cdek_tariff_pvz_mode: number
  cdek_tariff_door_mode: number
  sender_address: string
  parcel: Parcel
  markup: { cdek: Markup; pochta: Markup }
  free_shipping_methods: string[]
  payments: { manual: boolean; cod_methods: string[] }
}
type Markup = { type: "rub" | "pct"; value: number }
type Tariff = { code: number; name: string; mode: number; sum: number; days_min: number; days_max: number }
type Data = {
  settings: Settings
  defaults: { parcel: Parcel }
  cdek: { mode: "test" | "production"; own_keys: boolean; error: string | null; points: { code: string; address: string }[]; tariffs: Tariff[]; example: string; webhook_url: string }
  tbank: { configured: boolean; mode: "off" | "test" | "production"; terminal: string | null; receipts: boolean; notification_url: string }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { message?: string }).message ?? `Ошибка ${res.status}`)
  return body as T
}

const MODE = {
  test: { label: "Тестовый режим", color: "orange" as const },
  production: { label: "Боевой режим", color: "green" as const },
  off: { label: "Не подключена", color: "grey" as const },
}
const FROM_DOOR = new Set([1, 2, 7])
const PAID_METHODS = [["cdek-pvz", "СДЭК — пункт выдачи"], ["cdek-door", "СДЭК — курьер"], ["pochta", "Почта России"]] as const
const PVZ_MODES = [4, 2, 6, 7]
const DOOR_MODES = [3, 1]
const MODE_HINT: Record<number, string> = {
  1: "курьер СДЭК заберёт из магазина и привезёт покупателю",
  2: "курьер СДЭК заберёт из магазина, покупатель получит в пункте",
  3: "вы сдаёте в пункт СДЭК, курьер привезёт покупателю",
  4: "вы сдаёте в пункт СДЭК, покупатель получит в пункте",
  6: "вы сдаёте в пункт СДЭК, покупатель получит в постамате",
  7: "курьер СДЭК заберёт из магазина, покупатель получит в постамате",
}

const days = (t: Tariff) => (t.days_min === t.days_max ? `${t.days_max + 1} дн.` : `${t.days_min + 1}–${t.days_max + 1} дн.`)

function NumberField({ label, value, onChange, hint }: { label: string; value: number; onChange: (n: number) => void; hint?: string }) {
  return (
    <div className="flex flex-col gap-y-1">
      <Label size="small">{label}</Label>
      <Input size="small" inputMode="numeric" value={String(value)} onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "") || 0))} />
      {hint && <Text size="xsmall" className="text-ui-fg-subtle">{hint}</Text>}
    </div>
  )
}

/**
 * «Доставка и оплата»: бесплатная доставка, тарифы и пункт сдачи СДЭК, вес и коробка по умолчанию,
 * состояние подключений. Ключи хранятся в .env на сервере и здесь не показываются.
 */
const DeliveryPage = () => {
  const [data, setData] = useState<Data | null>(null)
  const [s, setS] = useState<Settings | null>(null)
  const [manualPoint, setManualPoint] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const d = await api<Data>("/admin/shop-settings")
    setData(d)
    setS(d.settings)
    setManualPoint(!d.cdek.points.some((p) => p.code === d.settings.cdek_shipment_point))
  }, [])

  useEffect(() => {
    load().catch((e) => toast.error((e as Error).message))
  }, [load])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => (x ? { ...x, [k]: v } : x))
  const setParcel = <K extends keyof Parcel>(k: K, v: Parcel[K]) => setS((x) => (x ? { ...x, parcel: { ...x.parcel, [k]: v } } : x))

  const pvzTariffs = useMemo(() => (data?.cdek.tariffs ?? []).filter((t) => PVZ_MODES.includes(t.mode)).sort((a, b) => a.sum - b.sum), [data])
  const doorTariffs = useMemo(() => (data?.cdek.tariffs ?? []).filter((t) => DOOR_MODES.includes(t.mode)).sort((a, b) => a.sum - b.sum), [data])

  const save = async () => {
    if (!s) return
    setSaving(true)
    try {
      await api("/admin/shop-settings", { method: "POST", body: JSON.stringify(s) })
      toast.success("Сохранено — на сайте уже действует")
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!data || !s) return <Container className="p-6"><Text>Загрузка…</Text></Container>

  const usesDropOff = !FROM_DOOR.has(s.cdek_tariff_pvz_mode) || !FROM_DOOR.has(s.cdek_tariff_door_mode)
  const usesPickup = FROM_DOOR.has(s.cdek_tariff_pvz_mode) || FROM_DOOR.has(s.cdek_tariff_door_mode)

  const tariffSelect = (list: Tariff[], code: number, onPick: (t: Tariff) => void) => (
    <Select value={String(code)} onValueChange={(v) => { const t = list.find((x) => String(x.code) === v); if (t) onPick(t) }}>
      <Select.Trigger><Select.Value placeholder="Тариф" /></Select.Trigger>
      <Select.Content>
        {!list.some((t) => t.code === code) && <Select.Item value={String(code)}>Тариф {code} (нет в списке для примера)</Select.Item>}
        {list.map((t) => (
          <Select.Item key={t.code} value={String(t.code)}>{t.name} · {t.sum} ₽ · {days(t)}</Select.Item>
        ))}
      </Select.Content>
    </Select>
  )

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Доставка и оплата</Heading>
          <Text size="small" className="text-ui-fg-subtle">Настройки, которые можно менять без программиста</Text>
        </div>
        <Button onClick={save} isLoading={saving}>Сохранить</Button>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4"><Heading level="h2">Бесплатная доставка</Heading></div>
        <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="free">Бесплатная доставка от, ₽</Label>
            <Input id="free" inputMode="numeric" value={String(s.free_shipping_from)} onChange={(e) => set("free_shipping_from", Number(e.target.value.replace(/\D/g, "") || 0))} />
            <Text size="small" className="text-ui-fg-subtle">Если товаров в корзине на эту сумму или больше. 0 — выключить.</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Для каких способов</Label>
            {PAID_METHODS.map(([code, label]) => (
              <label key={code} className="flex items-center gap-2 txt-small">
                <Checkbox checked={s.free_shipping_methods.includes(code)}
                  onCheckedChange={(v) => set("free_shipping_methods", v ? [...s.free_shipping_methods, code] : s.free_shipping_methods.filter((x) => x !== code))} />
                {label}
              </label>
            ))}
          </div>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">Оплата</Heading>
          <Text size="small" className="text-ui-fg-subtle">Какие способы оплаты видит покупатель при оформлении</Text>
        </div>
        <div className="grid gap-6 px-6 py-5 md:grid-cols-2">
          <div className="flex flex-col gap-y-3">
            <div className="flex items-start gap-3">
              <Switch className="shrink-0" checked={data.tbank.configured} disabled id="pay-online" />
              <div>
                <Label htmlFor="pay-online">Картой или СБП онлайн (Т-Касса)</Label>
                <Text size="small" className="text-ui-fg-subtle">{data.tbank.configured ? "Работает" : "Включится, когда в настройках сервера будут ключи терминала"}</Text>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Switch className="shrink-0" id="pay-manual" checked={s.payments.manual} onCheckedChange={(v) => set("payments", { ...s.payments, manual: v })} />
              <div>
                <Label htmlFor="pay-manual">Предоплата по ссылке</Label>
                <Text size="small" className="text-ui-fg-subtle">Заказ оформляется без оплаты, менеджер подтверждает наличие и присылает покупателю ссылку на оплату. В Telegram заказ придёт с пометкой «отправить ссылку на оплату».</Text>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Оплата при получении — для способов</Label>
            {[["pickup", "Самовывоз (оплата в магазине)"] as const, ["omsk-courier", "Курьер по Омску"] as const, ...PAID_METHODS].map(([code, label]) => (
              <label key={code} className="flex items-center gap-2 txt-small">
                <Checkbox checked={s.payments.cod_methods.includes(code)}
                  onCheckedChange={(v) => set("payments", { ...s.payments, cod_methods: v ? [...s.payments.cod_methods, code] : s.payments.cod_methods.filter((x) => x !== code) })} />
                {label}
              </label>
            ))}
            <Text size="small" className="text-ui-fg-subtle">Ничего не отмечено — только предоплата. Для СДЭК оплата при получении = наложенный платёж (должен быть в договоре со СДЭК).</Text>
          </div>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">Наценка на доставку</Heading>
          <Text size="small" className="text-ui-fg-subtle">Добавляется к цене СДЭК или Почты, которую видит покупатель. Например, на упаковку. 0 — без наценки.</Text>
        </div>
        <div className="grid gap-6 px-6 py-5 md:grid-cols-2">
          {(["cdek", "pochta"] as const).map((k) => {
            const m = s.markup[k]
            const example = Math.ceil(400 + (m.type === "pct" ? (400 * m.value) / 100 : m.value))
            return (
              <div key={k} className="flex flex-col gap-y-2">
                <Label>{k === "cdek" ? "СДЭК (пункт выдачи и курьер)" : "Почта России"}</Label>
                <div className="grid grid-cols-[1fr_140px] gap-2">
                  <Input inputMode="numeric" value={String(m.value)}
                    onChange={(e) => set("markup", { ...s.markup, [k]: { ...m, value: Number(e.target.value.replace(/\D/g, "") || 0) } })} />
                  <Select value={m.type} onValueChange={(v) => set("markup", { ...s.markup, [k]: { ...m, type: v as Markup["type"] } })}>
                    <Select.Trigger><Select.Value /></Select.Trigger>
                    <Select.Content>
                      <Select.Item value="rub">₽</Select.Item>
                      <Select.Item value="pct">%</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <Text size="small" className="text-ui-fg-subtle">
                  {m.value ? `Пример: доставка 400 ₽ → покупатель увидит ${example} ₽` : "Без наценки: покупатель видит цену перевозчика"}
                </Text>
              </div>
            )
          })}
          <Text size="xsmall" className="text-ui-fg-subtle md:col-span-2">Бесплатная доставка от суммы заказа действует как раньше — наценка тогда не берётся.</Text>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">СДЭК</Heading>
          <Badge color={MODE[data.cdek.mode].color}>{MODE[data.cdek.mode].label}</Badge>
        </div>
        <div className="grid gap-6 px-6 py-5 md:grid-cols-2">
          <div className="flex flex-col gap-y-2">
            <Label>Тариф до пункта выдачи</Label>
            {tariffSelect(pvzTariffs, s.cdek_tariff_pvz, (t) => setS({ ...s, cdek_tariff_pvz: t.code, cdek_tariff_pvz_mode: t.mode }))}
            <Text size="small" className="text-ui-fg-subtle">{MODE_HINT[s.cdek_tariff_pvz_mode]}</Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Тариф курьером до двери</Label>
            {tariffSelect(doorTariffs, s.cdek_tariff_door, (t) => setS({ ...s, cdek_tariff_door: t.code, cdek_tariff_door_mode: t.mode }))}
            <Text size="small" className="text-ui-fg-subtle">{MODE_HINT[s.cdek_tariff_door_mode]}</Text>
          </div>
          <Text size="xsmall" className="text-ui-fg-subtle md:col-span-2">
            Цены и сроки в списках — пример: {data.cdek.example}. Покупатель видит расчёт для своего города и своей корзины.
            {data.cdek.mode === "test" && " Сейчас тестовый кабинет СДЭК: набор тарифов и пунктов может отличаться от вашего договора."}
          </Text>

          {usesDropOff && (
            <div className="flex flex-col gap-y-2">
              <Label>Куда сдаём посылки</Label>
              {!manualPoint && data.cdek.points.length ? (
                <Select value={s.cdek_shipment_point} onValueChange={(v) => set("cdek_shipment_point", v)}>
                  <Select.Trigger><Select.Value placeholder="Пункт приёма" /></Select.Trigger>
                  <Select.Content>
                    {data.cdek.points.map((p) => <Select.Item key={p.code} value={p.code}>{p.address} · {p.code}</Select.Item>)}
                  </Select.Content>
                </Select>
              ) : (
                <Input value={s.cdek_shipment_point} onChange={(e) => set("cdek_shipment_point", e.target.value.toUpperCase())} placeholder="Код пункта, например OMS12" />
              )}
              <button type="button" className="text-ui-fg-interactive txt-small w-fit" onClick={() => setManualPoint(!manualPoint)}>
                {manualPoint ? "Выбрать из списка" : "Нужного пункта нет в списке — ввести код"}
              </button>
              <Text size="small" className="text-ui-fg-subtle">
                Код пункта есть на cdek.ru → «Офисы» → карточка пункта (например, OMS12).
                {data.cdek.mode === "test" && " В тестовом кабинете СДЭК в списке только часть пунктов Омска — с боевыми ключами появятся все."}
              </Text>
            </div>
          )}
          {usesPickup && (
            <div className="flex flex-col gap-y-2">
              <Label>Адрес магазина для курьера СДЭК (Омск)</Label>
              <Input value={s.sender_address} onChange={(e) => set("sender_address", e.target.value)} />
              <Text size="small" className="text-ui-fg-subtle">Выбран тариф «от двери»: курьер СДЭК приедет за посылкой сюда.</Text>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-y-2 px-6 py-4">
          {data.cdek.error && <Text size="small" className="text-ui-fg-error">СДЭК не отвечает: {data.cdek.error}</Text>}
          <Text size="small">
            {data.cdek.mode === "test"
              ? "Цены настоящие, но заказы создаются в тестовом кабинете СДЭК, а не в вашем. Для работы нужны ключи из кабинета СДЭК (Интеграция) — их вписывают в настройки сервера."
              : "Заказы создаются в вашем кабинете СДЭК, когда вы создаёте отправку в заказе."}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">Как отправить: заказ → «Создать отправку». Номер накладной, статус и ярлык появятся в блоке «СДЭК» справа в заказе.</Text>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h2">Вес и габариты по умолчанию</Heading>
            <Text size="small" className="text-ui-fg-subtle">Используются, если у товара не заполнены вес и размеры (товар → «Атрибуты»). По ним считаются цена доставки и заказ в СДЭК.</Text>
          </div>
          <Button size="small" variant="secondary" onClick={() => set("parcel", data.defaults.parcel)}>Вернуть как было</Button>
        </div>
        <div className="grid grid-cols-2 gap-4 px-6 py-5 md:grid-cols-6">
          <NumberField label="Длина коробки, см" value={s.parcel.box_length} onChange={(n) => setParcel("box_length", n)} />
          <NumberField label="Ширина коробки, см" value={s.parcel.box_width} onChange={(n) => setParcel("box_width", n)} />
          <NumberField label="Высота на 1 вещь, см" value={s.parcel.height_per_item} onChange={(n) => setParcel("height_per_item", n)} />
          <NumberField label="Высота мин., см" value={s.parcel.min_height} onChange={(n) => setParcel("min_height", n)} />
          <NumberField label="Высота макс., см" value={s.parcel.max_height} onChange={(n) => setParcel("max_height", n)} />
          <NumberField label="Вес, если не подошло, г" value={s.parcel.fallback_weight} onChange={(n) => setParcel("fallback_weight", n)} />
        </div>
        <div className="flex flex-col gap-y-2 px-6 py-5">
          <Label>Вес по названию товара (с упаковкой)</Label>
          <Text size="small" className="text-ui-fg-subtle">
            Слова через запятую — начало слова в названии: «куртк» подходит к «Куртка» и «Куртки». Правила проверяются сверху вниз, срабатывает первое.
          </Text>
          <div className="flex flex-col gap-y-2 pt-1">
            {s.parcel.weights.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_32px] items-center gap-2">
                <Input size="small" value={r.keywords} placeholder="худи, свитшот"
                  onChange={(e) => setParcel("weights", s.parcel.weights.map((x, j) => (j === i ? { ...x, keywords: e.target.value } : x)))} />
                <div className="flex items-center gap-1">
                  <Input size="small" inputMode="numeric" value={String(r.weight)}
                    onChange={(e) => setParcel("weights", s.parcel.weights.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value.replace(/\D/g, "") || 0) } : x)))} />
                  <Text size="small" className="text-ui-fg-subtle">г</Text>
                </div>
                <IconButton size="small" variant="transparent" aria-label="Удалить правило"
                  onClick={() => setParcel("weights", s.parcel.weights.filter((_, j) => j !== i))}><Trash /></IconButton>
              </div>
            ))}
          </div>
          <Button size="small" variant="secondary" className="w-fit" onClick={() => setParcel("weights", [...s.parcel.weights, { keywords: "", weight: 500 }])}>
            <Plus /> Добавить правило
          </Button>
        </div>
        <div className="flex justify-end px-6 py-4">
          <Button onClick={save} isLoading={saving}>Сохранить</Button>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Т-Касса (онлайн-оплата)</Heading>
          <Badge color={MODE[data.tbank.mode].color}>{MODE[data.tbank.mode].label}</Badge>
        </div>
        <div className="flex flex-col gap-y-2 px-6 py-4">
          <Text size="small">
            {data.tbank.configured
              ? `Терминал ${data.tbank.terminal}. Покупатели видят оплату картой и СБП.`
              : "Ключи терминала не заданы — на сайте только оплата при получении. Терминал и пароль берутся в кабинете Т-Бизнес и вписываются в настройки сервера."}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">Чеки 54-ФЗ через Т-Кассу: {data.tbank.receipts ? "включены" : "выключены"}.</Text>
          <Text size="small" className="text-ui-fg-subtle">Адрес уведомлений об оплате (передаётся автоматически): <code>{data.tbank.notification_url}</code></Text>
          <Text size="small" className="text-ui-fg-subtle">Возврат денег: заказ → платёж → «Возврат».</Text>
        </div>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Доставка и оплата",
  icon: RocketLaunch,
})

export default DeliveryPage
