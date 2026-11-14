/**
 * ВКонтакте API (посты о товарах в сообществе магазина). Сервер обращается к api.vk.com напрямую.
 * VK_ACCESS_TOKEN — ключ администратора (владельца) сообщества с правами wall, photos, groups, offline:
 * ключ самого сообщества не умеет загружать фото на стену. VK_GROUP_ID — номер сообщества (без минуса).
 */
const API = "https://api.vk.com/method"
const VERSION = "5.199"

export const vkGroupId = () => (process.env.VK_GROUP_ID ?? "").trim().replace(/^-/, "").replace(/^club/, "") || null
export const vkConfigured = () => Boolean(vkGroupId() && process.env.VK_ACCESS_TOKEN?.trim())

export class VkError extends Error {
  constructor(message: string, readonly code: number) {
    super(message)
  }
}

/** Понятные сообщения для частых ошибок ВКонтакте */
const HUMAN: Record<number, string> = {
  5: "ВКонтакте: ключ доступа неверный или устарел — получите новый и сохраните его на сервере (VK_ACCESS_TOKEN)",
  6: "ВКонтакте: слишком много запросов, пробуем позже",
  7: "ВКонтакте: у ключа нет прав — нужны wall, photos, groups, offline",
  15: "ВКонтакте: нет доступа к сообществу — ключ должен принадлежать администратору сообщества",
  214: "ВКонтакте: публикация на стене сообщества запрещена",
  219: "ВКонтакте: в посте не может быть ссылки — уберите ссылку или проверьте сайт",
}

export async function vkApi<T>(method: string, params: Record<string, string | number | undefined>): Promise<T> {
  const token = process.env.VK_ACCESS_TOKEN?.trim()
  if (!token) throw new Error("ВКонтакте не настроен: нет VK_ACCESS_TOKEN в настройках сервера")
  const body = new URLSearchParams({ access_token: token, v: VERSION })
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, String(v))
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(`${API}/${method}`, { method: "POST", body, signal: AbortSignal.timeout(60_000) })
    const d = (await r.json().catch(() => ({}))) as { response?: T; error?: { error_code: number; error_msg: string } }
    if (d.error) {
      // Слишком много запросов — ждём и повторяем
      if (d.error.error_code === 6 && attempt < 3) { await new Promise((res) => setTimeout(res, 1500 * attempt)); continue }
      throw new VkError(HUMAN[d.error.error_code] ?? `ВКонтакте: ${d.error.error_msg} (код ${d.error.error_code})`, d.error.error_code)
    }
    if (!r.ok || d.response === undefined) throw new Error(`ВКонтакте: ответ ${r.status}`)
    return d.response
  }
}

type UploadServer = { upload_url: string }
type Saved = { id: number; owner_id: number; access_key?: string }[]

/** Загрузить фото на стену сообщества (по одному: так требует ВКонтакте). Возвращает вложения photo<владелец>_<id> */
export async function uploadWallPhotos(files: Blob[]): Promise<string[]> {
  const group = vkGroupId()
  if (!group) throw new Error("ВКонтакте не настроен: нет VK_GROUP_ID в настройках сервера")
  const out: string[] = []
  for (const [i, file] of files.entries()) {
    const { upload_url } = await vkApi<UploadServer>("photos.getWallUploadServer", { group_id: group })
    const form = new FormData()
    form.append("photo", file, `p${i}.${file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1] || "jpg"}`)
    const up = (await (await fetch(upload_url, { method: "POST", body: form, signal: AbortSignal.timeout(120_000) })).json()) as { server: number; photo: string; hash: string }
    if (!up.photo || up.photo === "[]") continue
    const saved = await vkApi<Saved>("photos.saveWallPhoto", { group_id: group, server: up.server, photo: up.photo, hash: up.hash })
    if (saved[0]) out.push(`photo${saved[0].owner_id}_${saved[0].id}`)
  }
  return out
}

/** Ссылка на пост сообщества */
export const vkPostLink = (postId: number) => {
  const g = vkGroupId()
  return g ? `https://vk.com/wall-${g}_${postId}` : null
}
