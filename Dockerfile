# HarvestHub API — Bun + Hono
FROM oven/bun:1.1.38-alpine

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --production

COPY tsconfig.json ./
COPY src ./src
COPY uploads ./uploads

ENV PORT=3000
ENV NODE_ENV=production
ENV SMS_PROVIDER=console
ENV OTP_DEV_CODE=000000
ENV UPLOAD_DIR=./uploads

EXPOSE 3000

# Migrate then start (TiDB already has schema; migrate is idempotent)
CMD ["sh", "-c", "bun run src/db/migrate.ts && bun run src/index.ts"]
