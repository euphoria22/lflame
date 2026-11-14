import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const REDIS_URL = process.env.REDIS_URL
const S3_BUCKET = process.env.S3_BUCKET

/**
 * Модули инфраструктуры.
 * Локально без REDIS_URL Medusa работает на встроенных in-memory модулях.
 * На staging и production REDIS_URL обязателен (ТЗ, п. 1.3): события, workflow,
 * блокировки и кэш переживают перезапуск и работают при нескольких процессах.
 */
const redisModules = REDIS_URL
  ? [
    {
      resolve: "@medusajs/medusa/event-bus-redis",
      options: {
        redisUrl: REDIS_URL,
        jobOptions: { attempts: 3, removeOnComplete: { age: 3600 } },
      },
    },
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: {
        redis: { redisUrl: REDIS_URL },
      },
    },
    {
      resolve: "@medusajs/medusa/locking",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/locking-redis",
            id: "locking-redis",
            is_default: true,
            options: { redisUrl: REDIS_URL },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/caching",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/caching-redis",
            id: "caching-redis",
            is_default: true,
            options: { redisUrl: REDIS_URL, prefix: "lflame:" },
          },
        ],
      },
    },
  ]
  : []

/**
 * Файлы (фото товаров): S3-совместимое хранилище в РФ (ТЗ, п. 1.3).
 * Без S3_BUCKET используется локальная папка static/ (только для разработки).
 */
const fileModules = S3_BUCKET
  ? [
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            options: {
              file_url: process.env.S3_FILE_URL,
              access_key_id: process.env.S3_ACCESS_KEY_ID,
              secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
              region: process.env.S3_REGION,
              bucket: S3_BUCKET,
              endpoint: process.env.S3_ENDPOINT,
              // Адреса вида https://s3.regru.cloud/бакет — так работают все российские S3
              additional_client_config: { forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false" },
            },
          },
        ],
      },
    },
  ]
  : []

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    // Шифрование соединения с базой — только если она у внешнего провайдера (DATABASE_SSL=true).
    // Без этого Medusa в production включает SSL для любого адреса, кроме localhost,
    // и не может подключиться к Postgres в соседнем контейнере.
    databaseDriverOptions: {
      connection: { ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false },
    },
    redisUrl: REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      // Покупатель остаётся в аккаунте 30 дней (вход по коду)
      jwtExpiresIn: "30d",
      cookieSecret: process.env.COOKIE_SECRET,
      // Админы входят по паролю, покупатели — по коду на почту (ТЗ, п. 6.5, 8.2)
      authMethodsPerActor: { user: ["emailpass"], customer: ["otp"] },
    },
  },
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL,
    // Фото товаров с фотоаппарата и телефона весят 2–8 МБ; по умолчанию Medusa пускает только до 1 МБ.
    // На сайте фото всё равно сжимаются под экран, так что большой исходник не замедляет витрину
    maxUploadFileSize: 15 * 1024 * 1024,
  },
  modules: [
    ...redisModules,
    ...fileModules,
    { resolve: "./src/modules/brand" },
    {
      // Вход: emailpass — для админки, otp — код на почту для покупателей
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          { resolve: "@medusajs/medusa/auth-emailpass", id: "emailpass" },
          { resolve: "./src/modules/otp-auth", id: "otp" },
        ],
        // Двухфакторный вход в админку (приложение-аутентификатор): сотрудник включает в профиле.
        // Ключ шифрует секреты кодов в базе; без него MFA не включаем
        ...(process.env.AUTH_MFA_ENCRYPTION_KEY ? { mfa: { encryption_key: process.env.AUTH_MFA_ENCRYPTION_KEY } } : {}),
      },
    },
    { resolve: "./src/modules/account" },
    { resolve: "./src/modules/loyalty" },
    { resolve: "./src/modules/gift-card" },
    { resolve: "./src/modules/sort" },
    {
      // Оплата (ТЗ, п. 5.4): при получении (системный провайдер) и онлайн через Т-Кассу
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "./src/modules/tbank",
            id: "tbank",
            options: {
              terminalKey: process.env.TBANK_TERMINAL_KEY,
              password: process.env.TBANK_PASSWORD,
              apiUrl: process.env.TBANK_API_URL,
              taxation: process.env.TBANK_TAXATION,
              notificationUrl: `${(process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/+$/, "")}/hooks/payment/tbank_tbank`,
            },
          },
          {
            // Оплата частями — Яндекс Сплит; без ключа на витрине не предлагается
            resolve: "./src/modules/yandex-split",
            id: "split",
            options: {
              apiKey: process.env.YANDEX_PAY_API_KEY,
              sandbox: process.env.YANDEX_PAY_SANDBOX === "true",
            },
          },
        ],
      },
    },
    {
      // Доставка (ТЗ, п. 5): самовывоз (manual), СДЭК, Почта России
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          { resolve: "@medusajs/medusa/fulfillment-manual", id: "manual" },
          { resolve: "./src/modules/cdek", id: "cdek" },
          { resolve: "./src/modules/pochta", id: "pochta" },
        ],
      },
    },
    {
      resolve: "./src/modules/moysklad",
      options: {
        token: process.env.MOYSKLAD_TOKEN,
        storeName: process.env.MOYSKLAD_STORE_NAME,
        salePriceName: process.env.MOYSKLAD_SALE_PRICE,
        oldPriceName: process.env.MOYSKLAD_OLD_PRICE,
        webhookSecret: process.env.MOYSKLAD_WEBHOOK_SECRET,
        scheduleEnabled: process.env.MOYSKLAD_SCHEDULE_ENABLED === "true",
      },
    },
  ],
})
