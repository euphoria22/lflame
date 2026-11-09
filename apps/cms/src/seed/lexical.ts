/**
 * Простой текст -> формат редактора Payload (Lexical), для стартового наполнения.
 * «## » — заголовок, «### » — подзаголовок, «- » — пункт списка, «> » — цитата, **жирный**,
 * пустая строка — новый абзац.
 */
type Node = Record<string, unknown>

const base = { version: 1, direction: "ltr", format: "", indent: 0 }

function inline(s: string): Node[] {
  return s.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part) => {
    const bold = part.startsWith("**") && part.endsWith("**")
    return { type: "text", text: bold ? part.slice(2, -2) : part, format: bold ? 1 : 0, version: 1, detail: 0, mode: "normal", style: "" }
  })
}

export function md(text: string): { root: Node } {
  const children: Node[] = []
  let list: Node | null = null
  for (const block of text.trim().split(/\n\s*\n/)) {
    for (const raw of block.split("\n")) {
      const line = raw.trim()
      if (!line) continue
      if (line.startsWith("- ")) {
        if (!list) {
          list = { ...base, type: "list", listType: "bullet", tag: "ul", start: 1, children: [] }
          children.push(list)
        }
        ;(list.children as Node[]).push({ ...base, type: "listitem", value: (list.children as Node[]).length + 1, children: inline(line.slice(2)) })
        continue
      }
      list = null
      if (line.startsWith("### ")) children.push({ ...base, type: "heading", tag: "h3", children: inline(line.slice(4)) })
      else if (line.startsWith("## ")) children.push({ ...base, type: "heading", tag: "h2", children: inline(line.slice(3)) })
      else if (line.startsWith("> ")) children.push({ ...base, type: "quote", children: inline(line.slice(2)) })
      else children.push({ ...base, type: "paragraph", textFormat: 0, children: inline(line) })
    }
    list = null
  }
  return { root: { ...base, type: "root", children } }
}
