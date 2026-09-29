# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS frontend-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM frontend-deps AS frontend-build
WORKDIR /app
COPY index.html tsconfig*.json vite.config.ts eslint.config.js ./
COPY public ./public
COPY src ./src
COPY api ./api
RUN npm run build

FROM node:20-alpine AS backend-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS backend-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server ./
RUN npm run build

FROM node:20-alpine AS backend-runtime
ENV NODE_ENV=production
WORKDIR /app/server
RUN apk add --no-cache dumb-init curl && addgroup -S legatrixon && adduser -S legatrixon -G legatrixon
COPY --from=backend-deps /app/server/node_modules ./node_modules
COPY --from=backend-build /app/server/dist ./dist
COPY --from=backend-build /app/server/package*.json ./
USER legatrixon
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD curl -fsS http://127.0.0.1:3000/health/live || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main"]

FROM nginx:1.27-alpine AS frontend-runtime
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1