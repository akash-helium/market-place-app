import { Hono } from "hono";
import { z } from "zod";
import type { RowDataPacket } from "mysql2";
import { execute, query, queryOne, withTransaction } from "../config/db";
import { env } from "../config/env";
import { requireAuth, requireShop, type AppEnv } from "../middleware/auth";
import { slugify } from "../utils";

export const shopRoutes = new Hono<AppEnv>();

const contactSchema = z.object({
  kind: z.enum(["phone", "email"]),
  value: z.string().min(3).max(150),
  label: z.string().max(50).optional(),
});

const shopSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(2000).optional(),
  bannerUrl: z.string().url().max(500).optional(),
  logoUrl: z.string().url().max(500).optional(),
  addressLine: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  noteForBuyers: z.string().max(2000).optional(),   // the yellow "Note from seller" box
  contacts: z.array(contactSchema).max(10).optional(),
  deliveryPincodes: z.array(z.string().regex(/^\d{6}$/)).max(500).optional(),
});

/**
 * 4.3 "Set Up Your Shop (only the first time)" +
 * 4.4 "Change Your Shop Information Later" — same form, PUT is idempotent.
 * PUT /api/shops/me
 */
shopRoutes.put("/me", requireAuth, async (c) => {
  const body = shopSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    return c.json({ ok: false, error: "Invalid shop details", details: body.error.flatten() }, 400);
  }
  const user = c.get("user");
  const d = body.data;

  const shopId = await withTransaction(async (conn) => {
    let id = user.shopId;
    if (id) {
      await conn.execute(
        `UPDATE shops SET name=?, description=?, banner_url=?, logo_url=?,
                address_line=?, city=?, pincode=?, note_for_buyers=?
          WHERE id=?`,
        [d.name, d.description ?? null, d.bannerUrl ?? null, d.logoUrl ?? null,
         d.addressLine ?? null, d.city ?? null, d.pincode ?? null, d.noteForBuyers ?? null, id]
      );
    } else {
      const [res] = await conn.execute(
        `INSERT INTO shops (user_id, slug, name, description, banner_url, logo_url,
                            address_line, city, pincode, note_for_buyers)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user.id, slugify(d.name), d.name, d.description ?? null, d.bannerUrl ?? null,
         d.logoUrl ?? null, d.addressLine ?? null, d.city ?? null, d.pincode ?? null,
         d.noteForBuyers ?? null]
      );
      id = (res as { insertId: number }).insertId;
      await conn.execute(`UPDATE users SET onboarded = 1 WHERE id = ?`, [user.id]);
    }

    if (d.contacts) {
      await conn.execute(`DELETE FROM shop_contacts WHERE shop_id = ?`, [id]);
      for (const contact of d.contacts) {
        await conn.execute(
          `INSERT INTO shop_contacts (shop_id, kind, value, label) VALUES (?, ?, ?, ?)`,
          [id, contact.kind, contact.value, contact.label ?? null]
        );
      }
    }
    if (d.deliveryPincodes) {
      await conn.execute(`DELETE FROM shop_delivery_areas WHERE shop_id = ?`, [id]);
      for (const pin of d.deliveryPincodes) {
        await conn.execute(
          `INSERT IGNORE INTO shop_delivery_areas (shop_id, pincode) VALUES (?, ?)`,
          [id, pin]
        );
      }
    }
    return id!;
  });

  return c.json({ ok: true, data: { shopId, message: "Shop saved" } });
});

/** GET /api/shops/me — own profile (prefilled edit form) */
shopRoutes.get("/me", requireAuth, requireShop, async (c) => {
  const shop = await loadShop("id", c.get("user").shopId!);
  return c.json({ ok: true, data: shop });
});

/**
 * 4.9 The Shop's Full Page (Seller Profile) — public.
 * GET /api/shops/:idOrSlug
 */
shopRoutes.get("/:idOrSlug", async (c) => {
  const idOrSlug = c.req.param("idOrSlug");
  const byId = /^\d+$/.test(idOrSlug);
  const shop = await loadShop(byId ? "id" : "slug", byId ? Number(idOrSlug) : idOrSlug);
  if (!shop) return c.json({ ok: false, error: "Shop not found" }, 404);
  return c.json({ ok: true, data: shop });
});

/** Share link — "share your shop's link on WhatsApp" */
shopRoutes.get("/:id/share-link", async (c) => {
  const shop = await queryOne<RowDataPacket & { slug: string; name: string }>(
    `SELECT slug, name FROM shops WHERE id = ?`, [Number(c.req.param("id"))]
  );
  if (!shop) return c.json({ ok: false, error: "Shop not found" }, 404);
  const url = `${env.APP_URL}/shop/${shop.slug}`;
  return c.json({
    ok: true,
    data: {
      url,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shop.name} on HarvestHub: ${url}`)}`,
    },
  });
});

/** Location service — "tells if a buyer's address is within your delivery area" */
shopRoutes.get("/:id/delivers-to/:pincode", async (c) => {
  const shopId = Number(c.req.param("id"));
  const pincode = c.req.param("pincode");
  const areas = await query<RowDataPacket & { n: number }>(
    `SELECT COUNT(*) AS n FROM shop_delivery_areas WHERE shop_id = ?`, [shopId]
  );
  const total = areas[0]?.n ?? 0;
  if (total === 0) return c.json({ ok: true, data: { delivers: true, note: "No area limits set" } });
  const hit = await queryOne(
    `SELECT id FROM shop_delivery_areas WHERE shop_id = ? AND pincode = ?`, [shopId, pincode]
  );
  return c.json({ ok: true, data: { delivers: !!hit } });
});

// ---------- helpers ----------
async function loadShop(field: "id" | "slug", value: number | string) {
  const shop = await queryOne<RowDataPacket>(
    `SELECT id, slug, name, description, banner_url AS bannerUrl, logo_url AS logoUrl,
            address_line AS addressLine, city, pincode, note_for_buyers AS noteForBuyers,
            is_verified AS isVerified, rating_avg AS ratingAvg, rating_count AS ratingCount,
            created_at AS createdAt,
            TIMESTAMPDIFF(YEAR, created_at, NOW()) AS yearsOnPlatform
       FROM shops WHERE ${field} = ?`,
    [value]
  );
  if (!shop) return null;

  const [contacts, products] = await Promise.all([
    query(
      `SELECT kind, value, label FROM shop_contacts WHERE shop_id = ? ORDER BY id`,
      [shop.id]
    ),
    query(
      `SELECT p.id, p.title, p.pack_size AS packSize, p.price_paise AS pricePaise,
              p.in_stock AS inStock, c.name AS category, sc.name AS subcategory,
              (SELECT url FROM product_photos ph WHERE ph.product_id = p.id ORDER BY ph.is_cover DESC, ph.position LIMIT 1) AS coverUrl
         FROM products p
         JOIN categories c ON c.id = p.category_id
    LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
        WHERE p.shop_id = ? AND p.status = 'live'
        ORDER BY p.created_at DESC`,
      [shop.id]
    ),
  ]);

  return { ...shop, contacts, products, productCount: products.length };
}
