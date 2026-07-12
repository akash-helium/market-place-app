import { createMiddleware } from "hono/factory";
import { verifyToken } from "../utils";
import { queryOne } from "../config/db";
import type { RowDataPacket } from "mysql2";

export interface AuthUser {
  id: number;
  phone: string;
  onboarded: boolean;
  shopId: number | null;
}

export type AppEnv = {
  Variables: {
    user: AuthUser;
  };
};

interface SessionRow extends RowDataPacket {
  user_id: number;
  phone: string;
  onboarded: number;
  shop_id: number | null;
}

/** Requires a valid Bearer token bound to a non-revoked session. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return c.json({ ok: false, error: "Missing Authorization header" }, 401);

  const payload = verifyToken(token);
  if (!payload) return c.json({ ok: false, error: "Invalid or expired token" }, 401);

  const row = await queryOne<SessionRow>(
    `SELECT u.id AS user_id, u.phone, u.onboarded, s2.id AS shop_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
  LEFT JOIN shops s2 ON s2.user_id = u.id
      WHERE s.id = ? AND s.revoked_at IS NULL AND u.id = ?`,
    [payload.sid, Number(payload.sub)]
  );
  if (!row) return c.json({ ok: false, error: "Session expired — please log in again" }, 401);

  c.set("user", {
    id: row.user_id,
    phone: row.phone,
    onboarded: !!row.onboarded,
    shopId: row.shop_id,
  });
  await next();
});

/** Requires the user to have completed shop setup (has a shop). */
export const requireShop = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user?.shopId) {
    return c.json({ ok: false, error: "Complete your shop profile first" }, 403);
  }
  await next();
});
