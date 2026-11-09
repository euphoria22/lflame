/** Схемы «как снять мерки» для таблицы размеров — линии в цвет текста, как на прежнем сайте. */

/** Фигура: обхват груди, талии и бёдер. */
export function BodyMeasure({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 220" className={className} role="img" aria-label="Где измерять обхват груди, талии и бёдер">
      <circle cx="100" cy="110" r="100" fill="var(--surface)" />
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* шея и плечи */}
        <path d="M86 18c0 10-2 16-10 20-12 5-24 8-30 18-5 9-7 30-8 48" />
        <path d="M114 18c0 10 2 16 10 20 12 5 24 8 30 18 5 9 7 30 8 48" />
        {/* корпус */}
        <path d="M62 74c2 22 4 34 8 46 3 10 1 20-4 32-5 13-8 30-8 52" />
        <path d="M138 74c-2 22-4 34-8 46-3 10-1 20 4 32 5 13 8 30 8 52" />
      </g>
      {/* мерные ленты: грудь, талия, бёдра */}
      <g fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round">
        <path d="M60 88c26 9 54 9 80 0" />
        <path d="M68 128c21 7 43 7 64 0" />
        <path d="M60 176c26 9 54 9 80 0" />
      </g>
      <g fill="none" stroke="var(--subtle)" strokeWidth="9" strokeLinecap="round" opacity="0.6">
        <path d="M62 82c25-7 51-7 76 0" />
        <path d="M70 122c20-6 40-6 60 0" />
        <path d="M62 170c25-7 51-7 76 0" />
      </g>
    </svg>
  )
}

/** Стопа: длина от пятки до кончика самого длинного пальца. */
export function FootMeasure({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Длина стопы — от пятки до кончика пальца">
      <circle cx="100" cy="100" r="100" fill="var(--surface)" />
      <path
        d="M112 18c9 0 14 9 13 22-1 16-4 30-1 46 3 18 6 34 3 56-3 26-12 42-28 42-15 0-22-13-23-30-1-22 3-38 1-56-2-16-9-26-9-40 0-6 4-9 8-8 3-6 7-9 11-8 3-6 8-8 12-6 3-6 8-10 13-18z"
        fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M118 22 92 178" stroke="var(--subtle)" strokeWidth="7" strokeLinecap="round" />
    </svg>
  )
}

const CLOTHES = ["kurtki", "hudi-i-svitshoty", "svitery-i-kardigany", "futbolki-i-longslivy", "rubashki-i-polo", "bryuki", "shorty", "dzhinsy"]

/** Какую схему показать для таблицы: обувь — стопа, одежда и джинсы — фигура, аксессуары и бельё — без схемы. */
export function illustrationFor(categories: string[]): "foot" | "body" | null {
  if (categories.includes("obuv")) return "foot"
  if (categories.some((c) => CLOTHES.includes(c))) return "body"
  return null
}
