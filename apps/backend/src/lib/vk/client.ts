import { container } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { createHash, randomBytes } from "crypto"

/**
 * ВКонтакте API (посты о товарах в сообществе магазина). Сервер обращается к api.vk.com напрямую.
 *
 * Доступ — через VK ID (новые приложения ВКонтакте): кнопка «Подключить ВКонтакте» в админке («Соцсети»),
 * владелец сообщества разрешает доступ, сайт получает ключ (живёт час) и сам продлевает его.
 * Номер приложения, сообщество и ключи хранятся в metadata магазина (vk_auth) — видны только в админке.
 * Старый способ тоже работает: VK_ACCESS_TOKEN (бессрочный ключ) и VK_GROUP_ID в настройках сервера.
 */
const API = "https://api.vk.com/method"
const VERSION = "5.199"
const VKID = "https://id.vk.com"

export type VkAuth = {
  client_id?: string
  group?: string
  access_token?: string
  refresh_token?: string
  /** Когда истекает ключ, мс */
  expires_at?: number
  device_id?: string
  user_id?: number
  /** Права, которые выдал ВКонтакте (через пробел) */
  scope?: string
  /** Подключение в процессе: секрет PKCE и state */
  pending?: { verifier: string; state: string; redirect_uri: string; at: number }
  connected_at?: string
}

let auth: VkAuth = {}
let loadedAt = 0

async function storeRow() {
  const stores = (await container.resolve(Modules.STORE).listStores({}, { take: 1 })) as { id: string; metadata?: Record<string, unknown> | null }[]
  if (!stores[0]) throw new Error("Магазин не найден")
  return stores[0]
}

/** Прочитать подключение ВКонтакте из базы (не чаще раза в 30 секунд) */
export async function loadVkAuth(force = false): Promise<VkAuth> {
  if (!force && Date.now() - loadedAt < 30_000) return auth
  try {
    auth = (((await storeRow()).metadata?.vk_auth ?? {}) as VkAuth) || {}
    loadedAt = Date.now()
  } catch {
    // без базы (тесты) — только настройки сервера
  }
  return auth
}

export async function saveVkAuth(patch: Partial<VkAuth> | null): Promise<VkAuth> {
  const s = await storeRow()
  const cur = (s.metadata?.vk_auth ?? {}) as VkAuth
  const next = patch === null ? {} : { ...cur, ...patch }
  await container.resolve(Modules.STORE).updateStores(s.id, { metadata: { ...(s.metadata ?? {}), vk_auth: next } })
  auth = next
  loadedAt = Date.now()
  return next
}

/**
 * Сообщество: номер (123456, -123456, club123456) или короткое имя / ссылка (laflammeru, https://vk.ru/laflammeru).
 * Из админки или VK_GROUP_ID. Имя превращается в номер запросом к ВКонтакте один раз (ensureVkGroupId).
 */
const rawGroup = () => (auth.group || process.env.VK_GROUP_ID || "").trim().replace(/^https?:\/\/(m\.)?vk\.(com|ru)\//i, "").replace(/\/+$/, "").replace(/^-/, "")
let resolved: { raw: string; id: string } | null = null

/** Номер сообщества (цифры); для короткого имени — после ensureVkGroupId, до этого null */
export const vkGroupId = (): string | null => {
  const raw = rawGroup()
  if (!raw) return null
  const num = raw.replace(/^(club|public|event)(?=\d+$)/, "")
  if (/^\d+$/.test(num)) return num
  return resolved?.raw === raw ? resolved.id : null
}
const hasToken = () => Boolean(process.env.VK_ACCESS_TOKEN?.trim() || auth.refresh_token || auth.access_token)
/** Подключено: есть сообщество и ключ. Перед проверкой — loadVkAuth() */
export const vkConfigured = () => Boolean(rawGroup() && hasToken())

/** Узнать номер сообщества по короткому имени (laflammeru) — один раз */
export async function ensureVkGroupId(): Promise<string> {
  await loadVkAuth()
  const known = vkGroupId()
  if (known) return known
  const raw = rawGroup()
  if (!raw) throw new Error("ВКонтакте не настроен: не указано сообщество")
  const r = await vkApi<{ groups?: { id: number }[] } | { id: number }[]>("groups.getById", { group_id: raw })
  const id = (Array.isArray(r) ? r : r.groups ?? [])[0]?.id
  if (!id) throw new Error(`ВКонтакте: сообщество «${raw}» не найдено`)
  resolved = { raw, id: String(id) }
  return resolved.id
}

// ——— VK ID: подключение и продление ключа ———

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

/** Ссылка на страницу разрешения ВКонтакте (VK ID, OAuth 2.1 + PKCE). Права: стена, фото, сообщества */
export async function vkConnectUrl(clientId: string, group: string, redirectUri: string): Promise<string> {
  const verifier = b64url(randomBytes(48))
  const state = b64url(randomBytes(24))
  const challenge = b64url(createHash("sha256").update(verifier).digest())
  await saveVkAuth({ client_id: clientId, group, pending: { verifier, state, redirect_uri: redirectUri, at: Date.now() } })
  const q = new URLSearchParams({
    response_type: "code", client_id: clientId, redirect_uri: redirectUri, state,
    code_challenge: challenge, code_challenge_method: "S256", scope: "wall photos groups",
  })
  return `${VKID}/authorize?${q}`
}

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; user_id?: number; scope?: string; error?: string; error_description?: string }

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const r = await fetch(`${VKID}/oauth2/auth`, { method: "POST", body: new URLSearchParams(body), signal: AbortSignal.timeout(30_000) })
  const d = (await r.json().catch(() => ({}))) as TokenResponse
  if (d.error || !d.access_token) throw new Error(`ВКонтакте: ${d.error_description || d.error || `ответ ${r.status}`}`)
  return d
}

/** Возврат со страницы разрешения: обмен кода на ключи */
export async function vkFinishConnect(code: string, state: string, deviceId: string): Promise<void> {
  const a = await loadVkAuth(true)
  const p = a.pending
  if (!p || p.state !== state || Date.now() - p.at > 15 * 60_000) throw new Error("Подключение устарело — нажмите «Подключить ВКонтакте» ещё раз")
  const t = await tokenRequest({
    grant_type: "authorization_code", code, code_verifier: p.verifier, redirect_uri: p.redirect_uri,
    client_id: a.client_id ?? "", device_id: deviceId, state,
  })
  resolved = null
  await saveVkAuth({
    access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (t.expires_in ?? 3600) * 1000,
    device_id: deviceId, user_id: t.user_id, scope: t.scope, pending: undefined, connected_at: new Date().toISOString(),
  })
}

let refreshing: Promise<string> | null = null

/** Действующий ключ: из настроек сервера или из подключения VK ID (продлевается за 5 минут до конца) */
async function accessToken(): Promise<string> {
  const env = process.env.VK_ACCESS_TOKEN?.trim()
  if (env) return env
  const a = await loadVkAuth()
  if (a.access_token && (a.expires_at ?? 0) - Date.now() > 5 * 60_000) return a.access_token
  if (!a.refresh_token) throw new Error("ВКонтакте не подключён — нажмите «Подключить ВКонтакте» в разделе «Соцсети»")
  refreshing ??= (async () => {
    try {
      const fresh = await loadVkAuth(true)
      if (fresh.access_token && (fresh.expires_at ?? 0) - Date.now() > 5 * 60_000) return fresh.access_token
      const t = await tokenRequest({
        grant_type: "refresh_token", refresh_token: fresh.refresh_token ?? "", client_id: fresh.client_id ?? "",
        device_id: fresh.device_id ?? "", state: b64url(randomBytes(16)),
      })
      await saveVkAuth({ access_token: t.access_token, refresh_token: t.refresh_token ?? fresh.refresh_token, expires_at: Date.now() + (t.expires_in ?? 3600) * 1000 })
      return t.access_token!
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

export class VkError extends Error {
  constructor(message: string, readonly code: number) {
    super(message)
  }
}

/** Понятные сообщения для частых ошибок ВКонтакте */
const HUMAN: Record<number, string> = {
  5: "ВКонтакте: доступ отозван или устарел — нажмите «Подключить ВКонтакте» в разделе «Соцсети» ещё раз",
  6: "ВКонтакте: слишком много запросов, пробуем позже",
  7: "ВКонтакте: у приложения нет прав на стену и фото — включите их в настройках приложения ВКонтакте (Доступы) и подключите заново",
  15: "ВКонтакте: нет доступа — у ключа нет прав на это действие или аккаунт не администратор сообщества",
  214: "ВКонтакте: публикация на стене сообщества запрещена",
  219: "ВКонтакте: в посте не может быть ссылки — уберите ссылку или проверьте сайт",
}

export async function vkApi<T>(method: string, params: Record<string, string | number | undefined>): Promise<T> {
  const token = await accessToken()
  const body = new URLSearchParams({ access_token: token, v: VERSION })
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, String(v))
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(`${API}/${method}`, { method: "POST", body, signal: AbortSignal.timeout(60_000) })
    const d = (await r.json().catch(() => ({}))) as { response?: T; error?: { error_code: number; error_msg: string } }
    if (d.error) {
      // Слишком много запросов — ждём и повторяем
      if (d.error.error_code === 6 && attempt < 3) { await new Promise((res) => setTimeout(res, 1500 * attempt)); continue }
      // Подсказка + текст ВКонтакте и метод: по ним видно, чего не хватает (права ключа, админство в сообществе)
      const hint = HUMAN[d.error.error_code]
      throw new VkError(`${hint ?? "ВКонтакте"}. Ответ ВКонтакте (${method}): ${d.error.error_msg} (код ${d.error.error_code})`, d.error.error_code)
    }
    if (!r.ok || d.response === undefined) throw new Error(`ВКонтакте: ответ ${r.status}`)
    return d.response
  }
}

type UploadServer = { upload_url: string }
type Saved = { id: number; owner_id: number; access_key?: string }[]

/** Загрузить фото на стену сообщества (по одному: так требует ВКонтакте). Возвращает вложения photo<владелец>_<id> */
export async function uploadWallPhotos(files: Blob[]): Promise<string[]> {
  const group = await ensureVkGroupId()
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
