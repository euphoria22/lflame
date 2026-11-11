import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Text } from "@medusajs/ui"

/** Над списком товаров: переход к массовой правке флажков сайта. */
const ProductListFlagsWidget = () => (
  <Container className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
    <Text size="small" className="text-ui-fg-subtle">
      Предзаказ, новинки, закрепить наверху, Outlet, без скидок Club — фильтр и правка сразу у многих товаров.
    </Text>
    <Button size="small" variant="secondary" asChild><a href="/app/site-products">Флажки товаров</a></Button>
  </Container>
)

export const config = defineWidgetConfig({ zone: "product.list" })

export default ProductListFlagsWidget
