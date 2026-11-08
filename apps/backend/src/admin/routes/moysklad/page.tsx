import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Table, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type Run = {
  id: string
  kind: "catalog" | "stock"
  mode: string
  trigger: string
  status: "running" | "success" | "partial" | "failed"
  started_at: string
  finished_at: string | null
  stats: Record<string, unknown> | null
  error: string | null
}

type Problems = {
  checked_at: string | null
  counts: Record<string, number>
  items: { id: string; moysklad_id: string; title: string; problems: string[] }[]
}

const STATUS: Record<Run["status"], { label: string; color: "green" | "orange" | "red" | "blue" }> = {
  running: { label: "Идёт", color: "blue" },
  success: { label: "Успешно", color: "green" },
  partial: { label: "С ошибками", color: "orange" },
  failed: { label: "Ошибка", color: "red" },
}
const KIND: Record<Run["kind"], string> = { catalog: "Каталог", stock: "Остатки" }
const TRIGGER: Record<string, string> = { schedule: "По расписанию", manual: "Вручную", webhook: "Вебхук", script: "Скрипт" }

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("ru-RU") : "—")

function summary(run: Run): string {
  const s = run.stats ?? {}
  if (run.error) return run.error
  if (run.kind === "stock") return `обновлено остатков: ${s.updated ?? 0}, новых: ${s.created ?? 0}`
  return [
    `создано: ${s.created ?? 0}`,
    `обновлено: ${s.updated ?? 0}`,
    `без изменений: ${s.unchanged ?? 0}`,
    s.errors ? `ошибок: ${s.errors}` : null,
  ].filter(Boolean).join(", ")
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

/**
 * Панель синхронизации с МоимСкладом (ТЗ, п. 3.6): журнал, кнопки запуска,
 * отчёт о товарах с проблемами для сотрудника.
 */
const MoyskladPage = () => {
  const [runs, setRuns] = useState<Run[]>([])
  const [meta, setMeta] = useState<{ schedule_enabled: boolean; store_name: string } | null>(null)
  const [problems, setProblems] = useState<Problems | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([
      api<{ runs: Run[]; schedule_enabled: boolean; store_name: string }>("/admin/moysklad/runs"),
      api<Problems>("/admin/moysklad/problems"),
    ])
    setRuns(r.runs)
    setMeta({ schedule_enabled: r.schedule_enabled, store_name: r.store_name })
    setProblems(p)
  }, [])

  useEffect(() => {
    load().catch((e) => toast.error(String(e)))
    const t = setInterval(() => load().catch(() => undefined), 10000)
    return () => clearInterval(t)
  }, [load])

  const start = async (kind: "catalog" | "stock", mode: "incremental" | "full" = "incremental") => {
    setBusy(true)
    try {
      await api("/admin/moysklad/sync", { method: "POST", body: JSON.stringify({ kind, mode }) })
      toast.success("Синхронизация запущена. Результат появится в журнале.")
      setTimeout(() => load().catch(() => undefined), 1500)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading level="h1">МойСклад</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Склад: {meta?.store_name ?? "…"} · Автосинхронизация:{" "}
              {meta?.schedule_enabled ? "включена (каталог — 30 мин, остатки — 10 мин)" : "выключена"}
            </Text>
          </div>
          <div className="flex gap-x-2">
            <Button size="small" variant="secondary" disabled={busy} onClick={() => start("stock")}>
              Обновить остатки
            </Button>
            <Button size="small" variant="secondary" disabled={busy} onClick={() => start("catalog")}>
              Синхронизировать изменения
            </Button>
            <Button size="small" variant="secondary" disabled={busy} onClick={() => start("catalog", "full")}>
              Полная синхронизация
            </Button>
          </div>
        </div>

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Начало</Table.HeaderCell>
              <Table.HeaderCell>Что</Table.HeaderCell>
              <Table.HeaderCell>Запуск</Table.HeaderCell>
              <Table.HeaderCell>Статус</Table.HeaderCell>
              <Table.HeaderCell>Итог</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {runs.map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell>{fmt(r.started_at)}</Table.Cell>
                <Table.Cell>{KIND[r.kind]}{r.mode === "full" && r.kind === "catalog" ? " (полная)" : ""}</Table.Cell>
                <Table.Cell>{TRIGGER[r.trigger] ?? r.trigger}</Table.Cell>
                <Table.Cell>
                  <Badge size="2xsmall" color={STATUS[r.status].color}>{STATUS[r.status].label}</Badge>
                </Table.Cell>
                <Table.Cell className="max-w-[480px] truncate" title={summary(r)}>{summary(r)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        {!runs.length && (
          <Text size="small" className="px-6 py-4 text-ui-fg-subtle">Синхронизаций ещё не было</Text>
        )}
      </Container>

      <Container className="divide-y p-0">
        <div className="px-6 py-4">
          <Heading level="h2">Товары с проблемами</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Всего: {problems?.items.length ?? 0}. Название ведёт в МойСклад, «на сайте» — в карточку товара здесь.
            Исправьте в МоемСкладе — после синхронизации товар исчезнет из списка.
          </Text>
        </div>
        <div className="flex flex-wrap gap-2 px-6 py-4">
          {Object.entries(problems?.counts ?? {}).map(([k, v]) => (
            <Badge key={k} color="orange">{k}: {v}</Badge>
          ))}
          {problems && !problems.items.length && <Text size="small">Проблем нет</Text>}
        </div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Товар</Table.HeaderCell>
              <Table.HeaderCell>Проблемы</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {problems?.items.slice(0, 200).map((p) => (
              <Table.Row key={p.id}>
                <Table.Cell>
                  <a
                    className="text-ui-fg-interactive hover:underline"
                    href={`https://online.moysklad.ru/app/#good/edit?id=${p.moysklad_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {p.title}
                  </a>
                </Table.Cell>
                <Table.Cell>{p.problems.join("; ")}</Table.Cell>
                <Table.Cell>
                  <a className="text-ui-fg-interactive hover:underline" href={`/app/products/${p.id}`}>на сайте</a>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "МойСклад",
  icon: ArrowPath,
})

export default MoyskladPage
