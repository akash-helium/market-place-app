import jwt from "jsonwebtoken";
import { createHash, randomInt } from "node:crypto";
import { customAlphabet } from "nanoid";
import { env } from "../config/env";

// ---------- JWT (the "Login keeper") ----------
export interface JwtPayload {
  sub: string;      // user id
  sid: string;      // session id (jti) — lets us revoke on logout / new phone
}

export const sessionId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 21);

export function signToken(userId: number, sid: string): string {
  return jwt.sign({ sub: String(userId), sid }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as unknown as JwtPayload;
  } catch {
    return null;
  }
}

// ---------- OTP (the "SMS service" side) ----------
export function generateOtp(): string {
  // 6 numbers, like "482915"
  return String(randomInt(0, 10 ** env.OTP_LENGTH)).padStart(env.OTP_LENGTH, "0");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// ---------- Phone normalisation ----------
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  if (/^\d{10}$/.test(digits)) return `+91${digits}`; // Indian default, like the flag on the screen
  if (/^91\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

// ---------- Money ----------
export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const toRupees = (paise: number) => paise / 100;
export const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// ---------- Order numbers ----------
const orderNo = customAlphabet("0123456789", 6);
export const newOrderNumber = () => `#${orderNo()}`;

// ---------- Slugs for shop share links ----------
const slugSuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 5);
export function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
  return `${base || "shop"}-${slugSuffix()}`;
}
