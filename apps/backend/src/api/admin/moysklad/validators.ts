import { z } from "@medusajs/framework/zod"

export const MoyskladSyncBodySchema = z.object({
  kind: z.enum(["catalog", "stock"]),
  mode: z.enum(["incremental", "full"]).optional(),
})

export type MoyskladSyncBody = z.infer<typeof MoyskladSyncBodySchema>
