import { redirect } from "next/navigation"

/** Корень CMS-приложения ведёт в админку. */
export default function Home() {
  redirect("/cms")
}
