"use client"

import Image from "next/image"
import { Fragment, useEffect, useState } from "react"
import { createPortal } from "react-dom"

import type { SizeChart } from "@/lib/blog"
import { CloseIcon } from "./icons"
import { BodyMeasure, FootMeasure, illustrationFor } from "./size-illustrations"
import { usePresence } from "./use-presence"

/** «**жирный**» и переносы строк в пояснении под таблицей. */
function Note({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed text-muted">
      {text.split(/\n+/).map((line, i) => (
        <p key={i}>{line.split(/(\*\*[^*]+\*\*)/).map((part, j) => part.startsWith("**") ? <b key={j} className="font-medium text-foreground">{part.slice(2, -2)}</b> : <Fragment key={j}>{part}</Fragment>)}</p>
      ))}
    </div>
  )
}

/** Ссылка «Таблица размеров» и окно с таблицей под этот товар (мужская / женская, одежда / джинсы / обувь…). */
export function SizeGuide({ chart }: { chart: SizeChart }) {
  const [open, setOpen] = useState(false)
  const { mounted, state } = usePresence(open)

  useEffect(() => {
    if (!open) return
    document.documentElement.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => { document.documentElement.style.overflow = ""; window.removeEventListener("keydown", onKey) }
  }, [open])

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-[13px] text-muted underline underline-offset-4 hover:text-foreground">
        Таблица размеров
      </button>
      {mounted && createPortal(
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={chart.title}>
          <div data-state={state} className="overlay absolute inset-0 bg-black/25" onClick={() => setOpen(false)} />
          <div data-state={state} className="drawer-right glass-strong absolute inset-y-2 right-2 flex w-[calc(100%-16px)] max-w-[760px] flex-col rounded-[28px]">
            <div className="flex items-center justify-between px-6 pb-2 pt-5 md:px-8">
              <p className="text-[20px] tracking-tight">{chart.title}</p>
              <button type="button" aria-label="Закрыть" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-black/5"><CloseIcon className="size-6" /></button>
            </div>
            <div className="scroll-subtle flex-1 space-y-8 overflow-y-auto px-6 pb-8 pt-2 md:px-8">
              {chart.sections.map((s, i) => (
                <section key={i}>
                  {s.title && <h3 className="mb-3 text-[15px]">{s.title}</h3>}
                  {/* Широкие таблицы листаются вбок, первый столбец (названия строк) остаётся на месте */}
                  <div className="scroll-subtle overflow-x-auto rounded-2xl border border-line bg-background">
                    <table className="w-full border-collapse text-[13px]">
                      <tbody>
                        {s.rows.map((row, r) => (
                          <tr key={r} className={r ? "border-t border-line" : ""}>
                            {row.map((cell, c) => c === 0
                              ? <th key={c} scope="row" className={`sticky left-0 z-10 whitespace-nowrap bg-surface px-4 py-2.5 text-left font-normal ${r === 0 ? "font-medium" : "text-muted"}`}>{cell}</th>
                              : <td key={c} className={`whitespace-nowrap px-3 py-2.5 text-center ${r === 0 ? "font-medium" : ""}`}>{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
              {chart.image && (
                <Image src={chart.image.url} alt={chart.image.alt || chart.title} width={chart.image.width ?? 800} height={chart.image.height ?? 600}
                  sizes="700px" className="h-auto w-full max-w-[520px] rounded-2xl" />
              )}
              {/* Как снять мерки: текст и схема (фигура — для одежды и джинсов, стопа — для обуви), как на прежнем сайте */}
              {(chart.note || illustrationFor(chart.categories)) && (
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  {chart.note ? <div className="max-w-md"><Note text={chart.note} /></div> : <span />}
                  {illustrationFor(chart.categories) === "body" && <BodyMeasure className="size-40 shrink-0 self-center text-foreground" />}
                  {illustrationFor(chart.categories) === "foot" && <FootMeasure className="size-36 shrink-0 self-center text-foreground" />}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
