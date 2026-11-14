import sharp from "sharp"

/**
 * Фото для поста (Telegram и ВКонтакте): ровная сетка, как если бы пост собирали руками.
 * 1) Каждое фото — «каталожное» (товар на белом фоне) или «на модели» (студия, люди): по цвету краёв снимка.
 * 2) Первым рядом — каталожные, вторым — на модели; поровну, чтобы ряды не смешивались: 3+3 или 2+2.
 *    Лишние фото (детали, бирки, ещё один белый снимок) в пост не идут.
 * 3) Все фото — одной пропорции 4:5, без обрезки: поля цвета фона самого снимка. Тогда плитки одинаковые.
 */
export type PhotoKind = "white" | "model"
export type Photo = { buf: Buffer; kind: PhotoKind; bg: { r: number; g: number; b: number } }

export const MAX_PHOTOS = 6
const W = 1080
const H = 1350

/**
 * Края снимка (полоса в 2 пикселя на уменьшенной до 40×40 копии): доля светлых нейтральных пикселей (фон каталожного фото:
 * белый или светло-серый) и тёплых (бежевая студия), средний цвет.
 */
export async function borderStats(buf: Buffer): Promise<{ light: number; warm: number; bg: { r: number; g: number; b: number } }> {
  const size = 40
  const { data, info } = await sharp(buf).flatten({ background: "#ffffff" }).resize(size, size, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const ch = info.channels
  let light = 0, warm = 0, n = 0, r = 0, g = 0, b = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x > 1 && x < size - 2 && y > 1 && y < size - 2) continue
      const i = (y * size + x) * ch
      const R = data[i], G = data[i + 1], B = data[i + 2]
      n++
      // Светлый и нейтральный: белый и светло-серый фон каталожных фото
      if (Math.min(R, G, B) > 190 && Math.max(R, G, B) - Math.min(R, G, B) < 12) { light++; r += R; g += G; b += B }
      // Тёплый оттенок (красный заметно больше синего) — бежевая студия
      else if (R - B > 8 && R > 120) warm++
    }
  }
  // Поля: у каталожного фото — цвет его светлого фона, у остальных — средний цвет краёв
  const bg = light / n >= 0.5 ? { r: Math.round(r / light), g: Math.round(g / light), b: Math.round(b / light) } : await edgeMean(data, size, ch)
  return { light: light / n, warm: warm / n, bg }
}

async function edgeMean(data: Buffer, size: number, ch: number) {
  let r = 0, g = 0, b = 0, n = 0
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (x > 1 && x < size - 2 && y > 1 && y < size - 2) continue
    const i = (y * size + x) * ch
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
  }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }
}

/**
 * «Каталожное» — больше половины краёв светлые нейтральные и почти нет тёплых (товар может доходить до краёв кадра).
 * Иначе — «на модели» (студия, люди, детали крупным планом).
 */
export async function analyze(buf: Buffer): Promise<Omit<Photo, "buf">> {
  const s = await borderStats(buf)
  return { kind: s.light >= 0.5 && s.warm < 0.1 ? "white" : "model", bg: s.bg }
}

/**
 * Какие фото и в каком порядке (индексы). Каталожные — первым рядом, на модели — вторым, поровну:
 * по 3 (сетка 3+3) или по 2 (2+2). Фото одного вида — первые 6 (или 4). Мало фото — все, каталожные первыми.
 */
export function pickOrder(kinds: PhotoKind[], max = MAX_PHOTOS): number[] {
  const white = kinds.map((k, i) => (k === "white" ? i : -1)).filter((i) => i >= 0)
  const model = kinds.map((k, i) => (k === "model" ? i : -1)).filter((i) => i >= 0)
  const half = Math.floor(max / 2)
  const each = Math.min(white.length, model.length, half)
  if (each >= 2) return [...white.slice(0, each), ...model.slice(0, each)]
  // Только одного вида (или одно белое фото) — ровная сетка из 6 или 4 фото того вида, которого больше
  const main = model.length >= white.length ? model : white
  const lead = each === 1 ? [main === model ? white[0] : model[0]] : []
  const pool = [...lead, ...main]
  const count = pool.length >= max ? max : pool.length >= 4 ? 4 : pool.length
  return pool.slice(0, count)
}

/** Фото 4:5 с полями цвета фона (без обрезки), JPEG */
export async function toPortrait(p: Photo): Promise<Buffer> {
  return sharp(p.buf)
    .flatten({ background: p.bg })
    .resize(W, H, { fit: "contain", background: p.bg })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer()
}

/** Готовые фото для поста из скачанных (в порядке сайта) */
export async function preparePostPhotos(bufs: Buffer[], max = MAX_PHOTOS): Promise<Blob[]> {
  const photos: Photo[] = []
  for (const buf of bufs) {
    try {
      photos.push({ buf, ...(await analyze(buf)) })
    } catch {
      // не картинка — пропускаем
    }
  }
  const order = pickOrder(photos.map((p) => p.kind), max)
  const out: Blob[] = []
  for (const i of order) {
    const jpg = await toPortrait(photos[i]).catch(() => null)
    if (jpg) out.push(new Blob([new Uint8Array(jpg)], { type: "image/jpeg" }))
  }
  return out
}
