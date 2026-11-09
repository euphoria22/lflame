import type { Metadata } from "next"

import { FavoritesView } from "@/components/favorites-view"
import { NOINDEX } from "@/lib/seo"

export const metadata: Metadata = { title: "Избранное — LAFLAMME", ...NOINDEX }

export default function FavoritesPage() {
  return <FavoritesView />
}
