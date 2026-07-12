import { Hono } from "hono";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { execute, queryOne } from "../config/db";
import { env } from "../config/env";
import { smsService } from "../services";
import {
  generateOtp, sha256, normalizePhone, signToken, sessionId,
} from "../utils";
import { requireAuth, type AppEnv } from "../middleware/auth";

export const authRoutes = new Hono<AppEnv>();

const phoneSchema = z.object({ phone: z.string().min(10).max(20) });

/** True when no real SMS gateway is configured */
function smsIsDevStub() {
  const p = (env.SMS_PROVIDER || "console").toLowerCase();
  return p === "console" || p === "none" || p === "stub" || !env.SMS_API_KEY;
}

/**
 * Step 1 — "Type your phone number and tap Continue"
 * POST /api/auth/request-otp  { phone }
 */
authRoutes.post("/request-otp", async (c) => {
  const body = phoneSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "A valid phone number is required" }, 400);

  const phone = normalizePhone(body.data.phone);
  if (!phone) return c.json({ ok: false, error: "That phone number does not look right" }, 400);

  // "Resend after 30 seconds" — cooldown
  const recent = await queryOne<RowDataPacket & { created_at: Date }>(
    `SELECT created_at FROM otp_codes
      WHERE phone = ? AND created_at > (NOW() - INTERVAL ? SECOND)
      ORDER BY created_at DESC LIMIT 1`,
    [phone, env.OTP_RESEND_COOLDOWN_SECONDS]
  );
  if (recent) {
    return c.json({ ok: false, error: `Please wait ${env.OTP_RESEND_COOLDOWN_SECONDS} seconds before resending` }, 429);
  }

  // No SMS provider → fixed demo OTP so anyone can log in
  const code = smsIsDevStub() ? env.OTP_DEV_CODE : generateOtp();
  await execute(
    `INSERT INTO otp_codes (phone, code_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
    [phone, sha256(code), env.OTP_TTL_SECONDS]
  );
  await smsService.sendOtp(phone, code);

  return c.json({
    ok: true,
    data: {
      phone,
      resendAfterSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
      expiresInSeconds: env.OTP_TTL_SECONDS,
      ...(smsIsDevStub()
        ? { demoOtp: env.OTP_DEV_CODE, hint: `Use OTP ${env.OTP_DEV_CODE} (SMS not configured)` }
        : {}),
    },
  });
});

/**
 * Step 2 — "Type those 6 numbers in the app" → "You are verified."
 * POST /api/auth/verify-otp  { phone, code }
 * Returns a long-lived JWT (the "Login keeper") + whether onboarding is needed.
 */
authRoutes.post("/verify-otp", async (c) => {
  const schema = phoneSchema.extend({ code: z.string().regex(/^\d{6}$/) });
  const body = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "Phone and 6-digit code are required" }, 400);

  const phone = normalizePhone(body.data.phone);
  if (!phone) return c.json({ ok: false, error: "That phone number does not look right" }, 400);

  const otp = await queryOne<RowDataPacket & { id: number; code_hash: string; attempts: number }>(
    `SELECT id, code_hash, attempts FROM otp_codes
      WHERE phone = ? AND consumed_at IS NULL AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  if (!otp) return c.json({ ok: false, error: "Code expired — tap Resend for a new one" }, 400);
  if (otp.attempts >= env.OTP_MAX_ATTEMPTS) {
    return c.json({ ok: false, error: "Too many wrong tries — request a new code" }, 429);
  }

  const codeOk =
    otp.code_hash === sha256(body.data.code) ||
    (smsIsDevStub() && body.data.code === env.OTP_DEV_CODE);

  if (!codeOk) {
    await execute(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?`, [otp.id]);
    return c.json({ ok: false, error: "That code is not correct" }, 400);
  }

  await execute(`UPDATE otp_codes SET consumed_at = NOW() WHERE id = ?`, [otp.id]);

  // Upsert the user
  await execute(
    `INSERT INTO users (phone, is_verified) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE is_verified = 1`,
    [phone]
  );
  const user = await queryOne<RowDataPacket & { id: number; onboarded: number }>(
    `SELECT id, onboarded FROM users WHERE phone = ?`, [phone]
  );
  if (!user) return c.json({ ok: false, error: "Something went wrong" }, 500);

  // New session ("the app remembers you")
  const sid = sessionId();
  await execute(
    `INSERT INTO sessions (id, user_id, device_info) VALUES (?, ?, ?)`,
    [sid, user.id, c.req.header("User-Agent") ?? null]
  );

  return c.json({
    ok: true,
    data: {
      token: signToken(user.id, sid),
      isNewUser: !user.onboarded,   // if true → show "Set up your shop" (step 2 of 2)
      userId: user.id,
      phone,
    },
  });
});

/**
 * "If you log out ... the app will ask for the SMS code again"
 * POST /api/auth/logout
 */
authRoutes.post("/logout", requireAuth, async (c) => {
  const header = c.req.header("Authorization")!;
  const token = header.slice(7);
  const { verifyToken } = await import("../utils");
  const payload = verifyToken(token);
  if (payload) {
    await execute(`UPDATE sessions SET revoked_at = NOW() WHERE id = ?`, [payload.sid]);
  }
  return c.json({ ok: true, data: { message: "Logged out" } });
});

/** GET /api/auth/me — quick session check on app open */
authRoutes.get("/me", requireAuth, async (c) => {
  return c.json({ ok: true, data: c.get("user") });
});

/**
 * Dev-only: skip OTP and log in as a seeded seller (full shop + products).
 * POST /api/auth/dev-login  { phone?: "9810817196" }
 * Defaults to Rajat & Company.
 */
authRoutes.post("/dev-login", async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ ok: false, error: "Not available" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const raw = typeof body.phone === "string" ? body.phone : "9810817196";
  const phone = normalizePhone(raw);
  if (!phone) return c.json({ ok: false, error: "Invalid phone" }, 400);

  await execute(
    `INSERT INTO users (phone, is_verified, onboarded) VALUES (?, 1, 1)
     ON DUPLICATE KEY UPDATE is_verified = 1, onboarded = 1`,
    [phone]
  );
  const user = await queryOne<RowDataPacket & { id: number; onboarded: number }>(
    `SELECT id, onboarded FROM users WHERE phone = ?`,
    [phone]
  );
  if (!user) return c.json({ ok: false, error: "User not found — run db:seed" }, 404);

  const shop = await queryOne<RowDataPacket & { id: number; name: string }>(
    `SELECT id, name FROM shops WHERE user_id = ?`,
    [user.id]
  );
  if (!shop) {
    return c.json({
      ok: false,
      error: "No shop for this phone — run: bun run db:seed",
    }, 404);
  }

  const sid = sessionId();
  await execute(
    `INSERT INTO sessions (id, user_id, device_info) VALUES (?, ?, ?)`,
    [sid, user.id, c.req.header("User-Agent") ?? "dev-login"]
  );

  return c.json({
    ok: true,
    data: {
      token: signToken(user.id, sid),
      isNewUser: false,
      userId: user.id,
      phone,
      shopId: shop.id,
      shopName: shop.name,
    },
  });
});
