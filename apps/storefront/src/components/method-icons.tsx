/** Значки способов получения и оплаты по умолчанию — пока в админке не загружен логотип. */
type P = { className?: string }
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true }

export const StoreIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M4 9.5 5.5 4h13L20 9.5" /><path d="M4 9.5h16v1a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0 2.7 2.7 0 0 1-5.3 0z" /><path d="M5.5 13v7h13v-7M10 20v-4h4v4" /></svg>
)
export const CourierIcon = ({ className }: P) => (
  <svg {...base} className={className}><circle cx="6" cy="17" r="2.5" /><circle cx="18" cy="17" r="2.5" /><path d="M8.5 17h7M15 7h2l2.5 7.5M6 14.5 8 9h5l2 5.5M10 9V6.5h-2.5" /></svg>
)
export const PickupPointIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z" /><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8" /></svg>
)
export const TruckIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7" /><circle cx="6.5" cy="17" r="1.8" /><circle cx="17" cy="17" r="1.8" /></svg>
)
export const MailIcon = ({ className }: P) => (
  <svg {...base} className={className}><rect x="3" y="5.5" width="18" height="13" rx="1.5" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></svg>
)
export const CardIcon = ({ className }: P) => (
  <svg {...base} className={className}><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 9.5h19M6 15h4" /></svg>
)
/** Оплата частями: круг из четырёх долей */
export const PartsIcon = ({ className }: P) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17M3.5 12h17" /><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5H12z" fill="currentColor" stroke="none" /></svg>
)
export const HandIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M3 14.5h3l3.5-2h4a1.5 1.5 0 0 1 0 3H11" /><path d="m13.5 15.5 5-2.5a1.6 1.6 0 0 1 1.5 2.8L13 19.5H3" /><rect x="10" y="4" width="8" height="5.5" rx="1" /></svg>
)

/** Рамка под логотип/значок — одинакового размера для всех способов */
export function MethodLogo({ logo, alt, Fallback }: { logo?: string | null; alt: string; Fallback: (p: P) => React.ReactElement }) {
  return (
    <span className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface">
      {logo ? <img src={logo} alt={alt} className="max-h-7 max-w-[48px] object-contain" loading="lazy" /> : <Fallback className="size-5 text-muted" />}
    </span>
  )
}
