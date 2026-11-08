import Link from "next/link"

/** Временный логотип-надпись. Заменить на SVG-логотип LAFLAMME, когда будет файл. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="LAFLAMME — на главную" className={`text-[15px] font-semibold tracking-[0.32em] ${className}`}>
      LAFLAMME
    </Link>
  )
}
