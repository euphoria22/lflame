/** Микроразметка JSON-LD (ТЗ, п. 7.7). */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify экранирует строки; "<" дополнительно заменяется, чтобы нельзя было закрыть тег
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  )
}
