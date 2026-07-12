# HarvestHub API — Bun + Hono
FROM oven/bun:1.1.38-alpine

WORKDIR /app

# CA certs for TiDB / managed MySQL TLS
RUN apk add --no-cache ca-certificates && update-ca-certificates

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
ENV DB_SSL_CA=/etc/ssl/certs/ca-certificates.crt

EXPOSE 3000

CMD ["sh", "-c", "bun run src/db/migrate.ts && bun run src/index.ts"]
