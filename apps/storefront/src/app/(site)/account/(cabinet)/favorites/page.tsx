import type { Metadata } from "next"

import { FavoritesView } from "@/components/favorites-view"
import { NOINDEX } from "@/lib/seo"
import { pageTitle } from "@/lib/site"

export const instant = false
export const metadata: Metadata = { title: pageTitle("Избранное"), ...NOINDEX }

export default function AccountFavorites() {
  return <FavoritesView embedded />
}
