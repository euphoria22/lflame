"use client"

import { useEffect } from "react"

/**
 * Аварийная страница сайта (вместо английской заглушки Next.js).
 * Чаще всего ошибка — вкладка открыта со старой версии сайта, а сайт обновился: тогда один раз
 * тихо перезагружаем страницу. Если не помогло — покупатель видит понятный текст и кнопку.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      // Один раз перезагружаем сами (не чаще раза в минуту, чтобы не зациклиться)
      const key = "lf_reloaded_at"
      const last = Number(sessionStorage.getItem(key) ?? 0)
      if (Date.now() - last > 60_000) {
        sessionStorage.setItem(key, String(Date.now()))
        window.location.reload()
      }
    } catch {
      // sessionStorage недоступен — просто показываем страницу
    }
  }, [error])

  return (
    <html lang="ru">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", background: "#fff", color: "#0b0b0b" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420 }}>
            <p style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: "#6e6e6e", margin: 0 }}>Laflamme</p>
            <h1 style={{ fontSize: 28, fontWeight: 400, letterSpacing: "-.02em", margin: "12px 0 8px" }}>Страница не загрузилась</h1>
            <p style={{ fontSize: 15, lineHeight: 1.5, color: "#3a3a3a", margin: 0 }}>Похоже, сайт только что обновился. Обновите страницу — всё заработает.</p>
            <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
              <button type="button" onClick={() => window.location.reload()}
                style={{ height: 44, padding: "0 24px", borderRadius: 999, border: 0, background: "#0b0b0b", color: "#fff", fontSize: 14, cursor: "pointer" }}>Обновить</button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- после сбоя нужна полная загрузка, не переход внутри приложения */}
              <a href="/" onClick={() => reset()}
                style={{ height: 44, padding: "0 24px", borderRadius: 999, border: "1px solid #e7e7e7", background: "#fff", color: "#0b0b0b", fontSize: 14, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>На главную</a>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
