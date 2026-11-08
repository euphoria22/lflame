import Link from "next/link"

import { GENDERS, routes } from "@/lib/routes"

/** 404 с настоящим кодом ответа (ТЗ, п. 7.6, 7.9): поиск и основные разделы. */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-[96px] font-light leading-none tracking-tighter">404</p>
      <h1 className="mt-6 text-[20px]">Такой страницы нет</h1>
      <p className="mt-2 text-[14px] text-muted">Возможно, товар закончился или адрес изменился.</p>
      <form action={routes.search()} className="mt-8 flex w-full gap-2">
        <input name="q" placeholder="Поиск по каталогу" aria-label="Поиск по каталогу"
          className="h-12 flex-1 rounded-full border border-line px-5 text-[14px] outline-none focus:border-foreground" />
        <button className="h-12 rounded-full bg-foreground px-6 text-[14px] text-background">Найти</button>
      </form>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Link href={routes.newIn()} className="rounded-full bg-surface px-4 py-2 text-[13px]">Новинки</Link>
        {GENDERS.map((g) => <Link key={g.slug} href={routes.gender(g.slug)} className="rounded-full bg-surface px-4 py-2 text-[13px]">{g.name}</Link>)}
        <Link href={routes.brands()} className="rounded-full bg-surface px-4 py-2 text-[13px]">Бренды</Link>
      </div>
    </div>
  )
}
