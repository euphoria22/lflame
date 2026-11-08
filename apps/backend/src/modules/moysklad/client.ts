/**
 * Клиент JSON API МоегоСклада 1.2 (ТЗ, п. 3.1).
 * Лимиты МС: не более 45 запросов за 3 секунды и 5 параллельных.
 * Держим запас: до 4 параллельных и не чаще одного запроса в 80 мс.
 * 429 и 5xx повторяются с паузой (заголовок X-Lognex-Retry-After).
 */
export type MoyskladClientOptions = {
  token: string
  baseUrl?: string
  maxConcurrent?: number
  minIntervalMs?: number
  maxRetries?: number
}

export class MoyskladApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown
  ) {
    super(message)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class MoyskladClient {
  private readonly token: string
  private readonly baseUrl: string
  private readonly maxConcurrent: number
  private readonly minIntervalMs: number
  private readonly maxRetries: number
  private active = 0
  private lastStart = 0
  private waiters: (() => void)[] = []

  constructor(opts: MoyskladClientOptions) {
    this.token = opts.token
    this.baseUrl = (opts.baseUrl ?? "https://api.moysklad.ru/api/remap/1.2").replace(/\/+$/, "")
    this.maxConcurrent = opts.maxConcurrent ?? 4
    this.minIntervalMs = opts.minIntervalMs ?? 80
    this.maxRetries = opts.maxRetries ?? 5
  }

  isConfigured(): boolean {
    return Boolean(this.token)
  }

  private async acquire(): Promise<void> {
    while (this.active >= this.maxConcurrent) {
      await new Promise<void>((r) => this.waiters.push(r))
    }
    this.active++
    const wait = this.lastStart + this.minIntervalMs - Date.now()
    this.lastStart = Math.max(Date.now(), this.lastStart + this.minIntervalMs)
    if (wait > 0) {
      await sleep(wait)
    }
  }

  private release(): void {
    this.active--
    this.waiters.shift()?.()
  }

  private url(pathOrUrl: string, params?: Record<string, string | number | undefined>): string {
    const u = new URL(pathOrUrl.startsWith("http") ? pathOrUrl : `${this.baseUrl}/${pathOrUrl.replace(/^\/+/, "")}`)
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v !== undefined && v !== "") {
        u.searchParams.set(k, String(v))
      }
    }
    return u.toString()
  }

  private async request(method: string, url: string, body?: unknown): Promise<Response> {
    let attempt = 0
    for (;;) {
      await this.acquire()
      let res: Response | null = null
      let networkError: unknown = null
      try {
        res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Accept-Encoding": "gzip",
            Accept: "application/json;charset=utf-8",
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          redirect: "follow",
        })
      } catch (e) {
        networkError = e
      } finally {
        this.release()
      }

      const retryable = networkError || (res && (res.status === 429 || res.status >= 500))
      if (retryable && attempt < this.maxRetries) {
        attempt++
        const header = res?.headers.get("X-Lognex-Retry-After")
        const delay = header ? Number(header) : Math.min(30000, 500 * 2 ** attempt)
        await sleep(delay)
        continue
      }
      if (networkError) {
        throw networkError
      }
      return res!
    }
  }

  async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const res = await this.request("GET", this.url(path, params))
    return this.json<T>(res)
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request("POST", this.url(path), body)
    return this.json<T>(res)
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request("PUT", this.url(path), body)
    return this.json<T>(res)
  }

  private async json<T>(res: Response): Promise<T> {
    const text = await res.text()
    const data = text ? JSON.parse(text) : null
    if (!res.ok) {
      const msg = data?.errors?.map((e: { error: string }) => e.error).join("; ") || res.statusText
      throw new MoyskladApiError(`МойСклад: ${res.status} ${msg}`, res.status, data)
    }
    return data as T
  }

  /** Все строки списка с постраничной загрузкой по 1000. */
  async listAll<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T[]> {
    const rows: T[] = []
    let offset = 0
    for (;;) {
      const page = await this.get<{ rows: T[]; meta: { size: number } }>(path, { ...params, limit: 1000, offset })
      rows.push(...page.rows)
      offset += 1000
      if (offset >= page.meta.size || !page.rows.length) {
        return rows
      }
    }
  }

  /** Скачивание файла (фото товара) по downloadHref. */
  async download(href: string): Promise<{ buffer: Buffer; contentType: string }> {
    const res = await this.request("GET", href)
    if (!res.ok) {
      throw new MoyskladApiError(`МойСклад: не удалось скачать файл (${res.status})`, res.status)
    }
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
    }
  }
}
