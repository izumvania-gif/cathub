# CatHub: one image with PocketBase (API, realtime, PWA) + the Telegram bot.
# See docs/DEPLOY_AMVERA.md. Only /data persists on Amvera.

FROM node:22-alpine AS build
WORKDIR /src
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/bot/package.json apps/bot/
COPY packages/core/package.json packages/core/
COPY tests/e2e/package.json tests/e2e/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @cathub/web --filter @cathub/bot build

# BusyBox wget/unzip are in the base image, so no apk (and no Alpine mirror) is needed.
FROM node:22-alpine AS pocketbase
ARG TARGETARCH=amd64
COPY pocketbase/VERSION /tmp/PB_VERSION
RUN PB_VERSION="$(cat /tmp/PB_VERSION)" \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -O /tmp/pb.zip \
 && mkdir -p /pb && unzip -q /tmp/pb.zip pocketbase -d /pb

FROM node:22-alpine
COPY --from=pocketbase /pb/pocketbase /pb/pocketbase
COPY pocketbase/pb_migrations /pb/pb_migrations
COPY pocketbase/pb_hooks /pb/pb_hooks
COPY --from=build /src/apps/web/dist /pb/pb_public
COPY --from=build /src/apps/bot/dist /app/bot
COPY deploy/entrypoint.sh /entrypoint.sh
ENV NODE_ENV=production
EXPOSE 8090
CMD ["/bin/sh", "/entrypoint.sh"]
