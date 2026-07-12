export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",

  DB_HOST: process.env.DB_HOST ?? "127.0.0.1",
  DB_PORT: Number(process.env.DB_PORT ?? 3306),
  DB_USER: process.env.DB_USER ?? "root",
  DB_PASSWORD: process.env.DB_PASSWORD ?? "",
  DB_NAME: process.env.DB_NAME ?? "harvesthub",
  // TiDB Cloud / managed MySQL require TLS
  DB_SSL: (process.env.DB_SSL ?? "false").toLowerCase() === "true",
  DB_SSL_CA: process.env.DB_SSL_CA ?? "/etc/ssl/cert.pem",

  JWT_SECRET: process.env.JWT_SECRET ?? "change-me-in-production",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "30d", // "the app remembers you"

  OTP_LENGTH: 6,
  OTP_TTL_SECONDS: 300, // 5 minutes
  OTP_RESEND_COOLDOWN_SECONDS: 30, // "Resend after 30 seconds"
  OTP_MAX_ATTEMPTS: 5,

  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "./uploads",
  MAX_PRODUCT_PHOTOS: 4,
  MAX_BULK_FILE_MB: 10,

  // SMS provider (stub / MSG91 / Twilio ...)
  SMS_PROVIDER: process.env.SMS_PROVIDER ?? "console",
  SMS_API_KEY: process.env.SMS_API_KEY ?? "",
  /** When no real SMS provider: always accept this OTP after request-otp */
  OTP_DEV_CODE: process.env.OTP_DEV_CODE ?? "000000",

  // Payment provider (stub / Razorpay ...)
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER ?? "mock",
  PAYMENT_KEY_ID: process.env.PAYMENT_KEY_ID ?? "",
  PAYMENT_KEY_SECRET: process.env.PAYMENT_KEY_SECRET ?? "",
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET ?? "",

  // Ops admin panel (X-Admin-Key header)
  ADMIN_API_KEY: process.env.ADMIN_API_KEY ?? "harvesthub-admin-dev-key",
};
