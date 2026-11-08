import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { connection } from "next/server"

import { LoginForm } from "@/components/login-form"
import { NOINDEX } from "@/lib/seo"
import { currentCustomer } from "@/lib/store-api"

export const metadata: Metadata = { title: "Вход — LAFLAMME", ...NOINDEX }
export const instant = false

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await connection()
  const raw = (await searchParams).next ?? "/account"
  // Только внутренние адреса
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/account"
  if (await currentCustomer()) redirect(next)
  return <LoginForm next={next} />
}
