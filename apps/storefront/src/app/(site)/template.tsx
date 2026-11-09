/** Плавное появление страницы при каждом переходе (шапка и подвал остаются на месте). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>
}
