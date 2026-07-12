import { Hono } from "hono";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { env } from "../config/env";
import { execute, query, queryOne } from "../config/db";
import type { AppEnv } from "../middleware/auth";

export const adminRoutes = new Hono<AppEnv>();

function requireAdmin(c: { req: { header: (n: string) => string | undefined } }, next: () => Promise<Response | void>) {
  const key = c.req.header("x-admin-key") ?? c.req.header("X-Admin-Key");
  if (!key || key !== env.ADMIN_API_KEY) {
    return Promise.resolve(
      new Response(JSON.stringify({ ok: false, error: "Unauthorized admin" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
  }
  return next();
}

adminRoutes.use("*", async (c, next) => {
  const key = c.req.header("x-admin-key");
  if (!key || key !== env.ADMIN_API_KEY) {
    return c.json({ ok: false, error: "Unauthorized admin" }, 401);
  }
  await next();
});

adminRoutes.get("/stats", async (c) => {
  const [[shops], [products], [pendingKyc], [orders], [users]] = await Promise.all([
    query<RowDataPacket & { n: number }>(`SELECT COUNT(*) AS n FROM shops`),
    query<RowDataPacket & { n: number }>(`SELECT COUNT(*) AS n FROM products WHERE status = 'live'`),
    query<RowDataPacket & { n: number }>(`SELECT COUNT(*) AS n FROM kyc_submissions WHERE status = 'pending'`),
    query<RowDataPacket & { n: number }>(`SELECT COUNT(*) AS n FROM orders`),
    query<RowDataPacket & { n: number }>(`SELECT COUNT(*) AS n FROM users`),
  ]);
  return c.json({
    ok: true,
    data: {
      shops: shops?.n ?? 0,
      products: products?.n ?? 0,
      pendingKyc: pendingKyc?.n ?? 0,
      orders: orders?.n ?? 0,
      users: users?.n ?? 0,
    },
  });
});

adminRoutes.get("/kyc", async (c) => {
  const status = c.req.query("status") ?? "pending";
  const rows = await query<RowDataPacket>(
    `SELECT k.id, k.doc_type AS docType, k.doc_number AS docNumber, k.doc_file_url AS docFileUrl,
            k.status, k.reject_reason AS rejectReason, k.created_at AS createdAt,
            s.id AS shopId, s.name AS shopName, s.city AS shopCity
       FROM kyc_submissions k
       JOIN shops s ON s.id = k.shop_id
      WHERE (? = 'all' OR k.status = ?)
      ORDER BY k.created_at DESC
      LIMIT 100`,
    [status, status]
  );
  return c.json({ ok: true, data: { submissions: rows } });
});

adminRoutes.post("/kyc/:id/approve", async (c) => {
  const id = Number(c.req.param("id"));
  const sub = await queryOne<RowDataPacket & { id: number; shop_id: number }>(
    `SELECT id, shop_id FROM kyc_submissions WHERE id = ?`,
    [id]
  );
  if (!sub) return c.json({ ok: false, error: "Submission not found" }, 404);
  await execute(`UPDATE kyc_submissions SET status = 'approved', reviewed_at = NOW() WHERE id = ?`, [sub.id]);
  await execute(`UPDATE shops SET is_verified = 1 WHERE id = ?`, [sub.shop_id]);
  return c.json({ ok: true, data: { message: "Approved — shop has green tick" } });
});

adminRoutes.post("/kyc/:id/reject", async (c) => {
  const id = Number(c.req.param("id"));
  const body = z.object({ reason: z.string().min(3).max(500) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "reason required" }, 400);
  const sub = await queryOne<RowDataPacket & { id: number }>(`SELECT id FROM kyc_submissions WHERE id = ?`, [id]);
  if (!sub) return c.json({ ok: false, error: "Submission not found" }, 404);
  await execute(
    `UPDATE kyc_submissions SET status = 'rejected', reject_reason = ?, reviewed_at = NOW() WHERE id = ?`,
    [body.data.reason, id]
  );
  return c.json({ ok: true, data: { message: "Rejected" } });
});

adminRoutes.get("/shops", async (c) => {
  const rows = await query<RowDataPacket>(
    `SELECT s.id, s.name, s.slug, s.city, s.is_verified AS isVerified, s.logo_url AS logoUrl,
            s.rating_avg AS ratingAvg, s.created_at AS createdAt,
            (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.status = 'live') AS productCount,
            u.phone
       FROM shops s
       JOIN users u ON u.id = s.user_id
      ORDER BY s.created_at DESC
      LIMIT 200`
  );
  return c.json({ ok: true, data: { shops: rows } });
});

adminRoutes.patch("/shops/:id/verify", async (c) => {
  const id = Number(c.req.param("id"));
  const body = z.object({ verified: z.boolean() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "verified boolean required" }, 400);
  await execute(`UPDATE shops SET is_verified = ? WHERE id = ?`, [body.data.verified ? 1 : 0, id]);
  return c.json({ ok: true, data: { message: "Updated" } });
});

// silence unused
void requireAdmin;
