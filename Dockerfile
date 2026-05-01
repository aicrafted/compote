FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build:server

FROM oven/bun:1-slim
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json /app/bun.lock ./
RUN bun install --production --frozen-lockfile

VOLUME ["/data"]
EXPOSE 3000
ENV DATA_DIR=/data PORT=3000

CMD ["bun", "run", "server/index.ts"]
