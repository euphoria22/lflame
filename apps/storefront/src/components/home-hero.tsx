import Image from "next/image"
import Link from "next/link"
import { preload } from "react-dom"

import type { HomeHero } from "@/lib/blog"
import { GENDERS, routes } from "@/lib/routes"
import type { CatalogItem } from "@/lib/types"
import { ArrowIcon } from "./icons"

/**
 * Первый экран главной (ТЗ, п. 6.1). Баннер-кампания из CMS («Главная страница»):
 * широкое фото, заголовок и кнопки. Без баннера — две карточки «Мужское» / «Женское»
 * высотой не больше ~60% экрана, чтобы сразу были видны новинки.
 */
export function HomeHeroBlock({ hero, picks }: { hero: HomeHero | null; picks: Record<string, CatalogItem | undefined> }) {
  if (!hero) {
    return (
      <section className="grid gap-2 px-2 md:grid-cols-2 md:gap-3 md:px-4">
        {GENDERS.map((g, i) => {
          const pick = picks[g.slug]
          return (
            <Link key={g.slug} href={routes.gender(g.slug)} className="group relative block aspect-[4/5] overflow-hidden rounded-[28px] bg-surface md:aspect-auto md:h-[min(62vh,640px)]">
              {pick?.thumbnail && (
                <Image src={pick.thumbnail} alt={`${g.name} — ${pick.title}`} fill priority={i === 0} sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover object-[50%_20%] transition-transform duration-700 group-hover:scale-[1.03]" />
              )}
              <span className="glass absolute inset-x-4 bottom-4 flex items-center justify-between rounded-full px-6 py-4 text-[17px] md:inset-x-6 md:bottom-6">
                {g.name}
                <ArrowIcon className="size-5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          )
        })}
      </section>
    )
  }

  const buttons = hero.buttons.length ? hero.buttons : GENDERS.map((g) => ({ label: g.name, link: routes.gender(g.slug) }))
  const light = hero.textColor === "light"
  const pos = { top: "object-[50%_15%]", center: "object-center", bottom: "object-[50%_85%]" }[hero.focus]
  // Видео: обложка — первое, что видно на экране (LCP), грузим её раньше всего остального;
  // фото под видео тогда не нужно — иначе телефон качает две картинки
  const video = hero.video && hero.video.type !== "image/gif" ? hero.video : null
  if (video) preload(hero.image.url, { as: "image", fetchPriority: "high" })
  return (
    <section className="px-2 md:px-4">
      <div className="relative h-[min(78vh,640px)] min-h-[440px] overflow-hidden rounded-[28px] bg-surface md:h-[min(64vh,640px)]">
        {/* Отдельное фото для телефона, если загружено */}
        {video ? null : hero.imageMobile ? (
          <>
            <Image src={hero.imageMobile.url} alt={hero.imageMobile.alt || hero.title || ""} fill priority sizes="100vw" className="object-cover md:hidden" />
            <Image src={hero.image.url} alt={hero.image.alt || hero.title || ""} fill priority sizes="100vw" className={`hidden object-cover md:block ${pos}`} />
          </>
        ) : (
          <Image src={hero.image.url} alt={hero.image.alt || hero.title || ""} fill priority sizes="100vw" className={`object-cover ${pos}`} />
        )}
        {/* Видео или GIF поверх фото: без звука, по кругу. Фото — обложка, пока видео грузится */}
        {hero.video && (hero.video.type === "image/gif" ? (
          // eslint-disable-next-line @next/next/no-img-element -- анимированный GIF без пережатия
          <img src={hero.video.url} alt="" className={`absolute inset-0 h-full w-full object-cover ${pos}`} />
        ) : (
          <video className={`absolute inset-0 h-full w-full object-cover ${pos}`} autoPlay muted loop playsInline preload="metadata"
            poster={hero.image.url} aria-hidden>
            <source src={hero.video.url} type={hero.video.type} />
          </video>
        ))}
        {/* Затемнение снизу для читаемости белого текста */}
        {light && <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent" aria-hidden />}
        <div className="absolute inset-x-5 bottom-5 flex flex-col gap-4 md:inset-x-10 md:bottom-10 md:flex-row md:items-end md:justify-between">
          {(hero.eyebrow || hero.title) && (
            <div className={light ? "text-white" : "text-foreground"}>
              {hero.eyebrow && <p className="eyebrow opacity-80">{hero.eyebrow}</p>}
              {hero.title && <p className="mt-2 text-[34px] leading-none tracking-tight md:text-[56px]">{hero.title}</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {buttons.map((b) => (
              <Link key={b.link + b.label} href={b.link} className="glass flex items-center gap-3 rounded-full px-6 py-3 text-[15px] text-foreground">
                {b.label} <ArrowIcon className="size-4" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
