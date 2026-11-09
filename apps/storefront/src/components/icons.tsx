/** Иконки: тонкая линия 1.5px, наследуют цвет текста. */
type P = { className?: string }
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

export const SearchIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
)
export const HeartIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" /></svg>
)
export const BagIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></svg>
)
export const UserIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5" /></svg>
)
export const MenuIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}><path d="M4 8h16M4 16h16" /></svg>
)
export const CloseIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const ArrowIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)
export const ChevronIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}><path d="m6 9 6 6 6-6" /></svg>
)
export const FilterIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
)
export const TrashIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>
)

/* Соцсети: заливка, в круглой кнопке подвала */
export const VkIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
    <path d="M3 7h3.2c.3 3.1 1.6 4.8 2.8 5.2V7h3v2.9c1.2-.1 2.4-1.5 2.9-2.9H18c-.4 1.9-1.8 3.4-2.8 4 1 .5 2.6 1.8 3.2 4h-3.1c-.5-1.5-1.7-2.7-3.3-2.9V17h-.4C6.2 17 3.2 13.3 3 7Z" />
  </svg>
)
export const TelegramIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
    <path d="M20.7 4.3 2.9 11.2c-.9.4-.9 1.6.1 1.9l4.5 1.4 1.7 5.3c.2.7 1.1.9 1.6.4l2.5-2.4 4.6 3.4c.6.4 1.4.1 1.6-.6l3-14.4c.2-.9-.7-1.6-1.8-1.1ZM9.3 14.1l8.4-7.5-6.9 8.7-.3 2.9-1.2-4.1Z" />
  </svg>
)
