import { Hono } from "hono";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { execute, query, queryOne, withTransaction } from "../config/db";
import { requireAuth, requireShop, type AppEnv } from "../middleware/auth";
import { notificationService, storageService } from "../services";

export const notificationRoutes = new Hono<AppEnv>();
export const reviewRoutes = new Hono<AppEnv>();
export const queryRoutes = new Hono<AppEnv>();
export const kycRoutes = new Hono<AppEnv>();
export const uploadRoutes = new Hono<AppEnv>();

/* ============================================================
 * 4.11 The bell icon — Notifications
 * ==========================================================*/
notificationRoutes.get("/", requireAuth, async (c) => {
  const rows = await query<RowDataPacket>(
    `SELECT id, type, title, body, data_json AS data, is_read AS isRead, created_at AS createdAt
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
    [c.get("user").id]
  );
  const unread = rows.filter((r) => !r.isRead).length;
  return c.json({ ok: true, data: { notifications: rows, unread } });
});

notificationRoutes.post("/mark-all-read", requireAuth, async (c) => {
  await execute(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [c.get("user").id]);
  return c.json({ ok: true, data: { message: "All marked read" } });
});

notificationRoutes.patch("/:id/read", requireAuth, async (c) => {
  await execute(
    `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
    [Number(c.req.param("id")), c.get("user").id]
  );
  return c.json({ ok: true, data: { message: "Marked read" } });
});

/** Register a device push token so alerts arrive when the app is closed */
notificationRoutes.post("/push-token", requireAuth, async (c) => {
  const schema = z.object({ token: z.string().min(10).max(255), platform: z.enum(["android", "ios", "web"]).default("android") });
  const body = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "token is required" }, 400);
  await execute(
    `INSERT INTO push_tokens (user_id, token, platform) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), platform = VALUES(platform)`,
    [c.get("user").id, body.data.token, body.data.platform]
  );
  return c.json({ ok: true, data: { message: "Push token saved" } });
});

/* ============================================================
 * Ratings — "keeps track of every star and review"
 * ==========================================================*/
reviewRoutes.get("/shops/:shopId/reviews", async (c) => {
  const rows = await query<RowDataPacket>(
    `SELECT r.id, r.stars, r.comment, r.created_at AS createdAt, u.phone AS reviewerPhone
       FROM reviews r JOIN users u ON u.id = r.user_id
      WHERE r.shop_id = ? ORDER BY r.created_at DESC LIMIT 100`,
    [Number(c.req.param("shopId"))]
  );
  return c.json({ ok: true, data: { reviews: rows } });
});

reviewRoutes.post("/shops/:shopId/reviews", requireAuth, async (c) => {
  const schema = z.object({
    stars: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional(),
    orderId: z.number().int().positive().optional(),
  });
  const body = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "stars (1-5) is required" }, 400);

  const shopId = Number(c.req.param("shopId"));
  const user = c.get("user");

  if (body.data.orderId) {
    const owned = await queryOne(
      `SELECT id FROM orders WHERE id = ? AND buyer_id = ? AND shop_id = ?`,
      [body.data.orderId, user.id, shopId]
    );
    if (!owned) return c.json({ ok: false, error: "That order is not yours or not from this shop" }, 403);
  }

  await withTransaction(async (conn) => {
    await conn.execute(
      `INSERT INTO reviews (shop_id, user_id, order_id, stars, comment) VALUES (?, ?, ?, ?, ?)`,
      [shopId, user.id, body.data.orderId ?? null, body.data.stars, body.data.comment ?? null]
    );
    // Recompute the 4.8-style average
    await conn.execute(
      `UPDATE shops s SET
         rating_avg = (SELECT ROUND(AVG(stars), 1) FROM reviews WHERE shop_id = s.id),
         rating_count = (SELECT COUNT(*) FROM reviews WHERE shop_id = s.id)
       WHERE s.id = ?`,
      [shopId]
    );
  });

  const seller = await queryOne<RowDataPacket & { user_id: number }>(
    `SELECT user_id FROM shops WHERE id = ?`, [shopId]
  );
  if (seller) {
    await notificationService.newReview(seller.user_id, body.data.stars, body.data.comment ?? null, user.phone);
  }
  return c.json({ ok: true, data: { message: "Review posted" } }, 201);
});

/* ============================================================
 * Customer chat — "Query product (ask the seller a question)"
 * ==========================================================*/
queryRoutes.post("/products/:productId/queries", requireAuth, async (c) => {
  const schema = z.object({ question: z.string().min(2).max(1000) });
  const body = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "question is required" }, 400);

  const product = await queryOne<RowDataPacket & { id: number; title: string; shop_id: number }>(
    `SELECT id, title, shop_id FROM products WHERE id = ? AND status = 'live'`,
    [Number(c.req.param("productId"))]
  );
  if (!product) return c.json({ ok: false, error: "Product not found" }, 404);

  const user = c.get("user");
  const res = await execute(
    `INSERT INTO product_queries (product_id, shop_id, buyer_id, question) VALUES (?, ?, ?, ?)`,
    [product.id, product.shop_id, user.id, body.data.question]
  );

  const seller = await queryOne<RowDataPacket & { user_id: number }>(
    `SELECT user_id FROM shops WHERE id = ?`, [product.shop_id]
  );
  if (seller) {
    await notificationService.buyerQuery(seller.user_id, user.phone, product.title, res.insertId);
  }
  return c.json({ ok: true, data: { queryId: res.insertId, message: "Question sent to the seller" } }, 201);
});

/** Seller inbox */
queryRoutes.get("/queries", requireAuth, requireShop, async (c) => {
  const rows = await query<RowDataPacket>(
    `SELECT q.id, q.question, q.reply, q.replied_at AS repliedAt, q.created_at AS createdAt,
            p.id AS productId, p.title AS productTitle, u.phone AS buyerPhone
       FROM product_queries q
       JOIN products p ON p.id = q.product_id
       JOIN users u ON u.id = q.buyer_id
      WHERE q.shop_id = ? ORDER BY q.created_at DESC LIMIT 100`,
    [c.get("user").shopId!]
  );
  return c.json({ ok: true, data: { queries: rows } });
});

/** Buyer's own questions */
queryRoutes.get("/queries/mine", requireAuth, async (c) => {
  const rows = await query<RowDataPacket>(
    `SELECT q.id, q.question, q.reply, q.replied_at AS repliedAt, q.created_at AS createdAt,
            p.title AS productTitle, s.name AS shopName
       FROM product_queries q
       JOIN products p ON p.id = q.product_id
       JOIN shops s ON s.id = q.shop_id
      WHERE q.buyer_id = ? ORDER BY q.created_at DESC LIMIT 100`,
    [c.get("user").id]
  );
  return c.json({ ok: true, data: { queries: rows } });
});

queryRoutes.post("/queries/:id/reply", requireAuth, requireShop, async (c) => {
  const schema = z.object({ reply: z.string().min(1).max(1000) });
  const body = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "reply is required" }, 400);

  const q = await queryOne<RowDataPacket & { id: number; buyer_id: number; shop_id: number; product_id: number }>(
    `SELECT id, buyer_id, shop_id, product_id FROM product_queries WHERE id = ?`,
    [Number(c.req.param("id"))]
  );
  if (!q || q.shop_id !== c.get("user").shopId) return c.json({ ok: false, error: "Query not found" }, 404);

  await execute(`UPDATE product_queries SET reply = ?, replied_at = NOW() WHERE id = ?`, [body.data.reply, q.id]);
  await notificationService.notify(q.buyer_id, "query", "Seller replied to your question",
    body.data.reply.slice(0, 200), { queryId: q.id, productId: q.product_id });
  return c.json({ ok: true, data: { message: "Reply sent" } });
});

/* ============================================================
 * Verification (KYC) — FSSAI / GSTIN → green tick
 * ==========================================================*/
kycRoutes.post("/", requireAuth, requireShop, async (c) => {
  const schema = z.object({
    docType: z.enum(["FSSAI", "GSTIN"]),
    docNumber: z.string().min(5).max(50),
    docFileUrl: z.string().url().max(500).optional(),
  });
  const body = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "docType and docNumber are required" }, 400);

  const res = await execute(
    `INSERT INTO kyc_submissions (shop_id, doc_type, doc_number, doc_file_url)
     VALUES (?, ?, ?, ?)`,
    [c.get("user").shopId!, body.data.docType, body.data.docNumber, body.data.docFileUrl ?? null]
  );
  return c.json({ ok: true, data: { submissionId: res.insertId, status: "pending" } }, 201);
});

kycRoutes.get("/status", requireAuth, requireShop, async (c) => {
  const rows = await query<RowDataPacket>(
    `SELECT id, doc_type AS docType, doc_number AS docNumber, status, reject_reason AS rejectReason,
            created_at AS createdAt
       FROM kyc_submissions WHERE shop_id = ? ORDER BY created_at DESC`,
    [c.get("user").shopId!]
  );
  const shop = await queryOne<RowDataPacket & { is_verified: number }>(
    `SELECT is_verified FROM shops WHERE id = ?`, [c.get("user").shopId!]
  );
  return c.json({ ok: true, data: { verified: !!shop?.is_verified, submissions: rows } });
});

/** Internal/admin approval hook (protect behind an admin gateway in prod) */
kycRoutes.post("/:id/approve", requireAuth, async (c) => {
  const sub = await queryOne<RowDataPacket & { id: number; shop_id: number }>(
    `SELECT id, shop_id FROM kyc_submissions WHERE id = ?`, [Number(c.req.param("id"))]
  );
  if (!sub) return c.json({ ok: false, error: "Submission not found" }, 404);
  await execute(`UPDATE kyc_submissions SET status = 'approved', reviewed_at = NOW() WHERE id = ?`, [sub.id]);
  await execute(`UPDATE shops SET is_verified = 1 WHERE id = ?`, [sub.shop_id]);
  return c.json({ ok: true, data: { message: "Approved — shop now has the green tick" } });
});

/* ============================================================
 * Photo storage — upload endpoint
 * POST /api/uploads  multipart: file (jpeg/png/webp, <= 5 MB)
 * ==========================================================*/
uploadRoutes.post("/", requireAuth, async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return c.json({ ok: false, error: "Send an image in the 'file' field" }, 400);
  if (!storageService.isAllowedImage(file.type)) {
    return c.json({ ok: false, error: "Only JPEG, PNG or WebP images are allowed" }, 415);
  }
  if (file.size > 5 * 1024 * 1024) return c.json({ ok: false, error: "Image too large — max 5 MB" }, 413);

  const saved = await storageService.save(file);
  await execute(
    `INSERT INTO uploads (user_id, url, mime, size_bytes) VALUES (?, ?, ?, ?)`,
    [c.get("user").id, saved.url, saved.mime, saved.size]
  );
  return c.json({ ok: true, data: { url: saved.url } }, 201);
});
