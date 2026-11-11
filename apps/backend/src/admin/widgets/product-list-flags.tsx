import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Text } from "@medusajs/ui"

/** Над списком товаров: переход к массовой правке флажков сайта. */
const ProductListFlagsWidget = () => (
  <Container className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
    <Text size="small" className="text-ui-fg-subtle">
      Предзаказ, новинки, закрепление, Outlet, скидки Club — включить сразу у многих товаров. Там же — товары без описания и с 1–2 фото.
    </Text>
    <Button size="small" variant="secondary" asChild><a href="/app/site-products">Продажа на сайте</a></Button>
  </Container>
)

export const config = defineWidgetConfig({ zone: "product.list" })

export default ProductListFlagsWidget
