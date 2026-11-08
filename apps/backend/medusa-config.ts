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
    redisUrl: REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL,
  },
  modules: [
    ...redisModules,
    ...fileModules,
    { resolve: "./src/modules/brand" },
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
