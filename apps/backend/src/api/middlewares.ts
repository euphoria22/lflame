import { authenticate, configureStoreSearch, defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { MoyskladSyncBodySchema } from "./admin/moysklad/validators"

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    {
      // Личный кабинет: только вошедший покупатель (токен из входа по коду)
      matcher: "/store/account/me*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      // Скидка уровня: вход не обязателен (без входа — обычные цены)
      matcher: "/store/loyalty/cart",
      middlewares: [authenticate("customer", ["bearer"], { allowUnauthenticated: true })],
    },
    {
      // Уведомления Яндекс Пэй: тело — JWT-строка (application/octet-stream), читаем его сами
      method: ["POST"],
      matcher: "/hooks/yandex-split/v1/webhook",
      bodyParser: false,
    },
    {
      method: ["POST"],
      matcher: "/admin/moysklad/sync",
      middlewares: [validateAndTransformBody(MoyskladSyncBodySchema)],
    },
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
  ],
})
