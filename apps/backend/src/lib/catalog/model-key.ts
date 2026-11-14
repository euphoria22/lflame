type Keyable = { id: string; title: string; brand: { handle: string; name: string } | null; category: { handle: string } | null }

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean)

/**
 * Модель без цвета. Цвет в МоёмСкладе — последние слова названия («… Monologo 90s Fit Tofu» / «… Fit Dark Denim»),
 * поэтому модель — общее начало названий у товаров одного бренда и раздела, если отличаются только 1–3 последних слова.
 * Начало должно быть длиннее «тип + бренд + одно слово модели». Нет пары — модель = само название.
 */
export function modelKeys<T extends Keyable>(items: T[]): Map<string, string> {
  const out = new Map<string, string>()
  const groups = new Map<string, T[]>()
  for (const i of items) {
    const g = `${i.brand?.handle ?? ""}:${i.category?.handle ?? ""}`
    groups.set(g, [...(groups.get(g) ?? []), i])
  }
  for (const [g, list] of groups) {
    const ws = list.map((i) => words(i.title.toLowerCase()))
    list.forEach((item, a) => {
      const min = 2 + words(item.brand?.name ?? "").length
      let best = 0
      ws.forEach((other, b) => {
        if (a === b) return
        let n = 0
        while (n < ws[a].length && n < other.length && ws[a][n] === other[n]) n++
        if (n >= min && ws[a].length - n <= 3 && other.length - n <= 3) best = Math.max(best, n)
      })
      out.set(item.id, `${g}:${(best ? ws[a].slice(0, best) : ws[a]).join(" ")}`)
    })
  }
  return out
}
