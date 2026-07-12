import { mkdirSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { customAlphabet } from "nanoid";
import { env } from "../config/env";
import { execute } from "../config/db";
import { formatINR } from "../utils";

/* ============================================================
 * SMS service — "sends the 6-number code to your phone"
 * Pluggable: console (dev) or a real provider like MSG91/Twilio.
 * ==========================================================*/
export const smsService = {
  async sendOtp(phone: string, code: string): Promise<void> {
    const message = `Your HarvestHub code is ${code}. It expires in 5 minutes.`;
    switch (env.SMS_PROVIDER) {
      case "console":
        console.log(`[SMS → ${phone}] ${message}`);
        return;
      // case "msg91": / case "twilio": call the provider HTTP API with env.SMS_API_KEY
      default:
        console.log(`[SMS:${env.SMS_PROVIDER} → ${phone}] ${message}`);
    }
  },
};

/* ============================================================
 * Photo storage — "keeps all your photos safely"
 * Local disk in dev; swap the implementation for S3/GCS in prod.
 * ==========================================================*/
const fileId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export const storageService = {
  init() {
    if (!existsSync(env.UPLOAD_DIR)) mkdirSync(env.UPLOAD_DIR, { recursive: true });
  },

  isAllowedImage(mime: string) {
    return ALLOWED_IMAGE_MIME.has(mime);
  },

  /** Persist a file and return its public URL. */
  async save(file: File): Promise<{ url: string; size: number; mime: string }> {
    const ext = extname(file.name || "").toLowerCase() || ".bin";
    const name = `${Date.now()}-${fileId()}${ext}`;
    const path = join(env.UPLOAD_DIR, name);
    await Bun.write(path, file);
    return { url: `${env.APP_URL}/uploads/${name}`, size: file.size, mime: file.type };
  },
};

/* ============================================================
 * Payment service — "takes the buyer's money and pays it to you"
 * Mock provider for dev; the interface matches Razorpay-style flows.
 * ==========================================================*/
export interface PaymentIntent {
  provider: string;
  providerRef: string;
  amountPaise: number;
  /** what the mobile app needs to open the payment sheet */
  clientPayload: Record<string, unknown>;
}

export const paymentService = {
  async createIntent(orderId: number, amountPaise: number): Promise<PaymentIntent> {
    if (env.PAYMENT_PROVIDER === "mock") {
      return {
        provider: "mock",
        providerRef: `mock_${orderId}_${Date.now()}`,
        amountPaise,
        clientPayload: { note: "Mock gateway — POST /api/payments/mock/confirm to simulate success" },
      };
    }
    // Razorpay example (pseudo): POST https://api.razorpay.com/v1/orders with key id/secret
    throw new Error(`Payment provider '${env.PAYMENT_PROVIDER}' not configured`);
  },

  verifyWebhookSignature(_rawBody: string, _signature: string): boolean {
    if (env.PAYMENT_PROVIDER === "mock") return true;
    // Real providers: HMAC-SHA256(rawBody, env.PAYMENT_WEBHOOK_SECRET) === signature
    return false;
  },
};

/* ============================================================
 * Notification service — the bell icon + push
 * ==========================================================*/
export type NotificationType =
  | "order" | "query" | "payout" | "review" | "low_stock" | "pricing_tip" | "system";

export const notificationService = {
  async notify(
    userId: number,
    type: NotificationType,
    title: string,
    body?: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    await execute(
      `INSERT INTO notifications (user_id, type, title, body, data_json)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, type, title, body ?? null, data ? JSON.stringify(data) : null]
    );
    // Fire-and-forget push so alerts arrive "even when the app is closed".
    // Hook FCM/APNs here using push_tokens; console log in dev.
    console.log(`[PUSH → user ${userId}] ${title}${body ? " — " + body : ""}`);
  },

  /** Convenience wrappers matching the examples in the guide */
  async newOrder(sellerUserId: number, orderNumber: string, itemsCount: number, totalPaise: number, orderId: number) {
    await this.notify(sellerUserId, "order", "New order received",
      `Order ${orderNumber} · ${itemsCount} items · ${formatINR(totalPaise)}`, { orderId });
  },
  async buyerQuery(sellerUserId: number, buyerName: string, productTitle: string, queryId: number) {
    await this.notify(sellerUserId, "query", `Buyer query on ${productTitle}`,
      `${buyerName} asked a question`, { queryId });
  },
  async payout(sellerUserId: number, amountPaise: number) {
    await this.notify(sellerUserId, "payout", "Payout credited",
      `${formatINR(amountPaise)} settled to your bank`);
  },
  async newReview(sellerUserId: number, stars: number, comment: string | null, reviewer: string) {
    await this.notify(sellerUserId, "review", `New ${stars}-star review`,
      comment ? `"${comment}" — ${reviewer}` : `From ${reviewer}`);
  },
  async lowStock(sellerUserId: number, productTitle: string, unitsLeft: number, productId: number) {
    await this.notify(sellerUserId, "low_stock", "Low stock alert",
      `${productTitle} is down to ${unitsLeft} units left`, { productId });
  },
};
