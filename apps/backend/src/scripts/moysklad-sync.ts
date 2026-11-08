import { ExecArgs } from "@medusajs/framework/types"
import { runMoyskladSync } from "../lib/moysklad/run"

/**
 * Ручной запуск синхронизации с МоимСкладом.
 *
 *   npx medusa exec ./src/scripts/moysklad-sync.ts            # изменения с прошлого раза
 *   npx medusa exec ./src/scripts/moysklad-sync.ts full       # весь каталог
 *   npx medusa exec ./src/scripts/moysklad-sync.ts full 20    # весь каталог, создать не более 20 новых товаров
 *   npx medusa exec ./src/scripts/moysklad-sync.ts stock      # только остатки
 */
export default async function moyskladSync({ container, args }: ExecArgs) {
  const [mode = "incremental", limit] = args
  const result =
    mode === "stock"
      ? await runMoyskladSync(container, "stock", "script")
      : await runMoyskladSync(container, "catalog", "script", {
        mode: mode === "full" ? "full" : "incremental",
        createLimit: limit ? Number(limit) : undefined,
      })
  console.log(JSON.stringify(result, null, 2))
}
