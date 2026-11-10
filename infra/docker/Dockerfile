# Сборка LAFLAMME: один Dockerfile, цели backend / cms / storefront (ТЗ, п. 8.1).
# Все сервисы работают не от root (пользователь node).

FROM node:26-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json turbo.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/cms/package.json apps/cms/
COPY apps/storefront/package.json apps/storefront/
RUN npm ci --no-audit --no-fund

FROM deps AS source
COPY . .

# ---------- Medusa (магазин, админка, API) ----------
FROM source AS backend-build
RUN npm run build -w @lflame/backend

# Зависимости — ровно те, что в package-lock.json (без dev-пакетов)
FROM backend-build AS backend-prune
RUN npm prune --omit=dev --no-audit --no-fund && mkdir -p apps/backend/node_modules

FROM node:26-alpine AS backend
ENV MEDUSA_DISABLE_TELEMETRY=true
ENV NODE_ENV=production
COPY --from=backend-prune --chown=node:node /repo/node_modules /repo/node_modules
# Пакеты, которые npm положил в папку бэкенда (другие версии, чем в общей папке)
COPY --from=backend-prune --chown=node:node /repo/apps/backend/node_modules /repo/apps/backend/node_modules
COPY --from=backend-prune --chown=node:node /repo/apps/backend/.medusa/server /repo/apps/backend/.medusa/server
WORKDIR /repo/apps/backend/.medusa/server
RUN mkdir -p static && chown -R node:node /repo/apps/backend/.medusa/server
USER node
EXPOSE 9000
# Миграции базы — автоматически при каждом запуске (ТЗ, п. 8.1); бэкап делает deploy.sh перед выкладкой
CMD ["sh", "-c", "/repo/node_modules/.bin/medusa db:migrate && /repo/node_modules/.bin/medusa start"]

# ---------- Payload CMS ----------
FROM source AS cms-build
ARG CMS_URL
ARG PAYLOAD_DATABASE_URL
ARG PAYLOAD_SECRET
ENV NEXT_TELEMETRY_DISABLED=1 CMS_URL=$CMS_URL PAYLOAD_DATABASE_URL=$PAYLOAD_DATABASE_URL PAYLOAD_SECRET=$PAYLOAD_SECRET
RUN npm run build -w @lflame/cms

FROM node:26-alpine AS cms
WORKDIR /repo
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PAYLOAD_TELEMETRY_DISABLED=1
COPY --from=cms-build --chown=node:node /repo /repo
RUN mkdir -p /repo/apps/cms/media && chown -R node:node /repo/apps/cms/media
USER node
EXPOSE 3001
CMD ["npm", "run", "start", "-w", "@lflame/cms"]

# ---------- Витрина (Next.js) ----------
# При сборке витрина обращается к Medusa и CMS (страницы каталога собираются заранее) —
# поэтому deploy.sh сначала поднимает их, а сборка идёт в сети хоста (127.0.0.1).
FROM source AS storefront-build
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_YM_ID
ARG MEDUSA_BACKEND_URL
ARG CMS_URL
ARG CMS_PUBLIC_URL
ARG IMAGES_CDN_URL
ARG INDEXING
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY \
    NEXT_PUBLIC_YM_ID=$NEXT_PUBLIC_YM_ID MEDUSA_BACKEND_URL=$MEDUSA_BACKEND_URL CMS_URL=$CMS_URL CMS_PUBLIC_URL=$CMS_PUBLIC_URL \
    IMAGES_CDN_URL=$IMAGES_CDN_URL INDEXING=$INDEXING
# Каждая выкладка — новая сборка витрины: страницы собираются с актуальным каталогом (кэш Docker тут неуместен)
ARG BUILD_ID
RUN echo "build $BUILD_ID" && npm run build -w @lflame/storefront

FROM node:26-alpine AS storefront
WORKDIR /repo
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PAYLOAD_TELEMETRY_DISABLED=1
COPY --from=storefront-build --chown=node:node /repo /repo
USER node
EXPOSE 8000
CMD ["npm", "run", "start", "-w", "@lflame/storefront"]
