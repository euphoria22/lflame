import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"

import { absMedia, type LexicalNode } from "@/lib/blog"

/** Текст статьи из редактора Payload (Lexical) -> HTML. Поддерживаются блоки, которые даёт редактор CMS. */
export function RichText({ root, className = "article" }: { root: LexicalNode; className?: string }) {
  return <div className={className}>{render(root.children)}</div>
}

/** Часть текста (несколько блоков) — для карточек на информационных страницах. */
export function RichNodes({ nodes, className = "info-text" }: { nodes: LexicalNode[]; className?: string }) {
  return <div className={className}>{render(nodes)}</div>
}

// Битовые флаги форматирования Lexical
const BOLD = 1, ITALIC = 2, STRIKE = 4, UNDERLINE = 8, CODE = 16

function text(n: LexicalNode, key: number): ReactNode {
  let out: ReactNode = n.text
  const f = typeof n.format === "number" ? n.format : 0
  if (f & CODE) out = <code key={key}>{out}</code>
  if (f & BOLD) out = <strong key={key}>{out}</strong>
  if (f & ITALIC) out = <em key={key}>{out}</em>
  if (f & UNDERLINE) out = <u key={key}>{out}</u>
  if (f & STRIKE) out = <s key={key}>{out}</s>
  return <span key={key}>{out}</span>
}

function render(nodes: LexicalNode[] | undefined): ReactNode[] {
  return (nodes ?? []).map((n, i) => {
    const kids = render(n.children)
    switch (n.type) {
      case "text":
        return text(n, i)
      case "linebreak":
        return <br key={i} />
      case "paragraph":
        return kids.length ? <p key={i}>{kids}</p> : null
      case "heading": {
        // H1 на странице одна — заголовки в тексте начинаются с H2
        const Tag = (n.tag === "h1" ? "h2" : n.tag ?? "h2") as "h2" | "h3" | "h4"
        return <Tag key={i}>{kids}</Tag>
      }
      case "quote":
        return <blockquote key={i}>{kids}</blockquote>
      case "list":
        return n.listType === "number" ? <ol key={i}>{kids}</ol> : <ul key={i}>{kids}</ul>
      case "listitem":
        return <li key={i}>{kids}</li>
      case "horizontalrule":
        return <hr key={i} />
      case "link":
      case "autolink": {
        const url = n.fields?.url ?? n.url ?? "#"
        const internal = url.startsWith("/") || /laflamme/i.test(url)
        return internal
          ? <Link key={i} href={url.replace(/^https?:\/\/[^/]+/, "") || "/"}><>{kids}</></Link>
          : <a key={i} href={url} target="_blank" rel="noopener noreferrer">{kids}</a>
      }
      case "upload": {
        const v = n.value
        const src = absMedia(v?.sizes?.large?.url || v?.url)
        if (!src) return null
        return (
          <figure key={i}>
            <Image src={src} alt={v?.alt ?? ""} width={v?.width ?? 1600} height={v?.height ?? 1000} sizes="(min-width: 768px) 720px, 100vw" className="h-auto w-full rounded-[18px]" />
            {v?.alt && <figcaption>{v.alt}</figcaption>}
          </figure>
        )
      }
      default:
        return kids.length ? <span key={i}>{kids}</span> : null
    }
  })
}
