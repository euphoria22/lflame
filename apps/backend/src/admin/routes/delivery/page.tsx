import { defineRouteConfig } from "@medusajs/admin-sdk"
import { RocketLaunch } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Select, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type Data = {
  settings: { free_shipping_from: number; cdek_shipment_point: string }
  cdek: { mode: "test" | "production"; own_keys: boolean; error: string | null; points: { code: string; address: string }[]; webhook_url: string }
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

/**
 * «Доставка и оплата»: порог бесплатной доставки, пункт сдачи посылок СДЭК,
 * состояние подключений СДЭК и Т-Кассы. Ключи хранятся в .env на сервере и здесь не показываются.
 */
const DeliveryPage = () => {
  const [data, setData] = useState<Data | null>(null)
  const [free, setFree] = useState("")
  const [point, setPoint] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const d = await api<Data>("/admin/shop-settings")
    setData(d)
    setFree(String(d.settings.free_shipping_from))
    setPoint(d.settings.cdek_shipment_point)
  }, [])

  useEffect(() => {
    load().catch((e) => toast.error((e as Error).message))
  }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await api("/admin/shop-settings", {
        method: "POST",
        body: JSON.stringify({ free_shipping_from: Number(free.replace(/\s/g, "") || 0), cdek_shipment_point: point }),
      })
      toast.success("Сохранено. На сайте изменится в течение минуты.")
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!data) return <Container className="p-6"><Text>Загрузка…</Text></Container>

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h1">Доставка и оплата</Heading>
          <Text size="small" className="text-ui-fg-subtle">Настройки, которые можно менять без программиста</Text>
        </div>
        <div className="grid gap-6 px-6 py-5 md:grid-cols-2">
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="free">Бесплатная доставка от, ₽</Label>
            <Input id="free" inputMode="numeric" value={free} onChange={(e) => setFree(e.target.value.replace(/[^\d\s]/g, ""))} />
            <Text size="small" className="text-ui-fg-subtle">
              СДЭК и Почта России бесплатно, если товаров в корзине на эту сумму или больше. 0 — выключить.
            </Text>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label>Куда сдаём посылки СДЭК</Label>
            {data.cdek.points.length ? (
              <Select value={point} onValueChange={setPoint}>
                <Select.Trigger><Select.Value placeholder="Пункт приёма" /></Select.Trigger>
                <Select.Content>
                  {data.cdek.points.map((p) => (
                    <Select.Item key={p.code} value={p.code}>{p.address} · {p.code}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            ) : (
              <Input value={point} onChange={(e) => setPoint(e.target.value)} placeholder="OMS6" />
            )}
            <Text size="small" className="text-ui-fg-subtle">Пункт СДЭК в Омске, куда вы относите посылки. Указывается в каждом заказе СДЭК.</Text>
          </div>
        </div>
        <div className="flex justify-end px-6 py-4">
          <Button onClick={save} isLoading={saving}>Сохранить</Button>
        </div>
      </Container>

      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">СДЭК</Heading>
          <Badge color={MODE[data.cdek.mode].color}>{MODE[data.cdek.mode].label}</Badge>
        </div>
        <div className="flex flex-col gap-y-2 px-6 py-4">
          {data.cdek.error && <Text className="text-ui-fg-error">СДЭК не отвечает: {data.cdek.error}</Text>}
          <Text size="small">
            {data.cdek.mode === "test"
              ? "Цены настоящие, но заказы создаются в тестовом кабинете СДЭК, а не в вашем. Для работы нужны ключи из кабинета СДЭК (Интеграция) — их вписывают в настройки сервера."
              : "Заказы создаются в вашем кабинете СДЭК, когда вы создаёте отправку в заказе."}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">Как отправить: заказ → «Создать отправку». Номер накладной, статус и ярлык появятся в блоке «СДЭК» справа в заказе.</Text>
          <Text size="small" className="text-ui-fg-subtle">Адрес для уведомлений о статусах: <code>{data.cdek.webhook_url}</code></Text>
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
