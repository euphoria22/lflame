import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cdekLabelPdf } from "../../../../../lib/delivery/cdek-orders"

/** Ярлык СДЭК (PDF, A6) для наклейки на посылку. Ссылка — в отправке заказа в админке. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pdf = await cdekLabelPdf(req.params.uuid)
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="cdek-${req.params.uuid}.pdf"`)
    res.send(Buffer.from(pdf))
  } catch (e) {
    res.status(502).json({ message: (e as Error).message })
  }
}
