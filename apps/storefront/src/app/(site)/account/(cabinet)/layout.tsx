import { connection } from "next/server"

import { AccountNav } from "@/components/account-nav"
import { getAccount } from "@/lib/account"

export const instant = false

/** Личный кабинет (ТЗ, п. 6.5): меню разделов и содержимое. */
export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  await connection()
  await getAccount()
  return (
    <div className="mx-auto max-w-[1680px] px-4 pb-24 pt-6 md:px-8">
      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
        <aside className="md:sticky md:top-[110px] md:h-fit md:pt-[88px]"><AccountNav /></aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
