import { Hono } from "hono";
import { z } from "zod";
import * as XLSX from "xlsx";
import type { RowDataPacket } from "mysql2";
import { execute, query, queryOne, withTransaction } from "../config/db";
import { env } from "../config/env";
import { requireAuth, requireShop, type AppEnv } from "../middleware/auth";
import { recordProductPrice } from "../services/priceHistory";
import { toPaise } from "../utils";

export const categoryRoutes = new Hono<AppEnv>();
export const productRoutes = new Hono<AppEnv>();

function priceChangeSummary(
  points: Array<{ pricePaise: number | null; recordedAt: string | Date }>
) {
  const priced = points.filter((p) => p.pricePaise != null) as Array<{
    pricePaise: number;
    recordedAt: string | Date;
  }>;
  if (priced.length === 0) {
    return {
      previousPaise: null as number | null,
      changePaise: null as number | null,
      changePct: null as number | null,
      dayAgoPaise: null as number | null,
      direction: "flat" as const,
    };
  }
  const current = priced[priced.length - 1]!;
  const previous = priced.length >= 2 ? priced[priced.length - 2]! : null;
  const dayAgoCutoff = Date.now() - 24 * 60 * 60 * 1000;
  let dayAgo: (typeof priced)[0] | null = null;
  for (let i = priced.length - 1; i >= 0; i--) {
    const t = new Date(priced[i]!.recordedAt).getTime();
    if (t <= dayAgoCutoff) {
      dayAgo = priced[i]!;
      break;
    }
  }
  if (!dayAgo && priced.length >= 2) dayAgo = priced[0]!;

  const baseline = dayAgo ?? previous;
  const changePaise = baseline ? current.pricePaise - baseline.pricePaise : null;
  const changePct =
    baseline && baseline.pricePaise !== 0 && changePaise != null
      ? Math.round((changePaise / baseline.pricePaise) * 10000) / 100
      : null;
  const direction =
    changePaise == null || changePaise === 0 ? "flat" : changePaise > 0 ? "up" : "down";

  return {
    previousPaise: previous?.pricePaise ?? null,
    changePaise,
    changePct,
    dayAgoPaise: dayAgo?.pricePaise ?? null,
    direction: direction as "up" | "down" | "flat",
  };
}

/* ============================================================
 * 4.5 Home screen — "big tiles for each kind of dal"
 * GET /api/categories
 * ==========================================================*/
categoryRoutes.get("/", async (c) => {
  const cats = await query<RowDataPacket>(
    `SELECT c.id, c.name, c.tagline, c.icon_url AS iconUrl,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status='live') AS itemCount
       FROM categories c ORDER BY c.sort_order, c.name`
  );
  return c.json({ ok: true, data: { categories: cats, count: cats.length } });
});

/**
 * Seller creates (or reuses) a category by name.
 * POST /api/categories  { name, tagline? }
 */
categoryRoutes.post("/", requireAuth, requireShop, async (c) => {
  const schema = z.object({
    name: z.string().trim().min(1).max(80),
    tagline: z.string().trim().max(150).optional(),
  });
  const body = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "Category name is required" }, 400);

  const name = body.data.name;
  const existing = await queryOne<RowDataPacket & { id: number; name: string }>(
    `SELECT id, name FROM categories WHERE LOWER(name) = LOWER(?)`,
    [name]
  );
  if (existing) {
    return c.json({ ok: true, data: { id: existing.id, name: existing.name, created: false } });
  }

  const maxSort = await queryOne<RowDataPacket & { m: number | null }>(
    `SELECT MAX(sort_order) AS m FROM categories`
  );
  const res = await execute(
    `INSERT INTO categories (name, tagline, sort_order) VALUES (?, ?, ?)`,
    [name, body.data.tagline ?? null, (maxSort?.m ?? 0) + 1]
  );
  return c.json(
    { ok: true, data: { id: Number(res.insertId), name, created: true } },
    201
  );
});

/* 4.6 Picking a type — subtypes with counts ("Chitra 15 items") */
categoryRoutes.get("/:id/subcategories", async (c) => {
  const subs = await query<RowDataPacket>(
    `SELECT sc.id, sc.name, sc.icon_url AS iconUrl,
            (SELECT COUNT(*) FROM products p WHERE p.subcategory_id = sc.id AND p.status='live') AS itemCount
       FROM subcategories sc WHERE sc.category_id = ? ORDER BY sc.name`,
    [Number(c.req.param("id"))]
  );
  return c.json({ ok: true, data: { subcategories: subs } });
});

/**
 * Seller creates (or reuses) a subcategory under a category.
 * POST /api/categories/:id/subcategories  { name }
 */
categoryRoutes.post("/:id/subcategories", requireAuth, requireShop, async (c) => {
  const schema = z.object({ name: z.string().trim().min(1).max(80) });
  const body = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "Subcategory name is required" }, 400);

  const categoryId = Number(c.req.param("id"));
  const cat = await queryOne(`SELECT id FROM categories WHERE id = ?`, [categoryId]);
  if (!cat) return c.json({ ok: false, error: "Category not found" }, 404);

  const name = body.data.name;
  const existing = await queryOne<RowDataPacket & { id: number; name: string }>(
    `SELECT id, name FROM subcategories
      WHERE category_id = ? AND LOWER(name) = LOWER(?)`,
    [categoryId, name]
  );
  if (existing) {
    return c.json({
      ok: true,
      data: { id: existing.id, name: existing.name, categoryId, created: false },
    });
  }

  const res = await execute(
    `INSERT INTO subcategories (category_id, name) VALUES (?, ?)`,
    [categoryId, name]
  );
  return c.json(
    {
      ok: true,
      data: { id: Number(res.insertId), name, categoryId, created: true },
    },
    201
  );
});

/* ============================================================
 * 4.7 Product list with prices  (+ Search helper, + Sort)
 * GET /api/products?categoryId=&subcategoryId=&q=&sort=price_asc|price_desc|newest&page=&limit=
 * ==========================================================*/
productRoutes.get("/", async (c) => {
  const q = c.req.query();
  const page = Math.max(1, Number(q.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(q.limit ?? 20)));
  const offset = (page - 1) * limit;

  const where: string[] = [`p.status = 'live'`];
  const params: unknown[] = [];

  if (q.categoryId)    { where.push(`p.category_id = ?`);    params.push(Number(q.categoryId)); }
  if (q.subcategoryId) { where.push(`p.subcategory_id = ?`); params.push(Number(q.subcategoryId)); }
  if (q.shopId)        { where.push(`p.shop_id = ?`);        params.push(Number(q.shopId)); }
  if (q.inStock === "1" || q.inStock === "true") {
    where.push(`p.in_stock = 1`);
  }
  if (q.q && q.q.trim()) {
    // LIKE search (TiDB Cloud has no MySQL FULLTEXT)
    where.push(`(p.title LIKE ? OR p.description LIKE ?)`);
    const like = `%${q.q.trim()}%`;
    params.push(like, like);
  }

  const sort =
    q.sort === "price_asc"  ? `p.price_paise IS NULL, p.price_paise ASC` :
    q.sort === "price_desc" ? `p.price_paise IS NULL, p.price_paise DESC` :
    `p.created_at DESC`;

  const rows = await query<RowDataPacket>(
    `SELECT p.id, p.title, p.pack_size AS packSize, p.price_paise AS pricePaise,
            p.in_stock AS inStock, p.shop_id AS shopId,
            c.name AS category, sc.name AS subcategory,
            s.name AS shopName, s.city AS shopCity, s.rating_avg AS shopRating,
            (SELECT url FROM product_photos ph WHERE ph.product_id = p.id
              ORDER BY ph.is_cover DESC, ph.position LIMIT 1) AS coverUrl
       FROM products p
       JOIN categories c ON c.id = p.category_id
  LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
       JOIN shops s ON s.id = p.shop_id
      WHERE ${where.join(" AND ")}
      ORDER BY ${sort}
      LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  // price_paise NULL → the app shows "N/A — please ring the seller"
  return c.json({ ok: true, data: { products: rows, page, limit } });
});

/* 4.8 One product closely — details + who is selling it */
/* Price history must be registered before bare /:id */
productRoutes.get("/:id/price-history", async (c) => {
  const id = Number(c.req.param("id"));
  const days = Math.min(365, Math.max(1, Number(c.req.query("days") ?? 30)));
  const product = await queryOne(`SELECT id FROM products WHERE id = ? AND status = 'live'`, [id]);
  if (!product) return c.json({ ok: false, error: "Product not found" }, 404);

  const rows = await query<RowDataPacket & { pricePaise: number | null; mrpPaise: number | null; recordedAt: Date; source: string }>(
    `SELECT price_paise AS pricePaise, mrp_paise AS mrpPaise, recorded_at AS recordedAt, source
       FROM product_price_history
      WHERE product_id = ? AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY recorded_at ASC, id ASC`,
    [id, days]
  );

  // If nothing in window, still return latest few points so chart isn't empty
  let points = rows;
  if (points.length === 0) {
    points = await query(
      `SELECT price_paise AS pricePaise, mrp_paise AS mrpPaise, recorded_at AS recordedAt, source
         FROM product_price_history
        WHERE product_id = ?
        ORDER BY recorded_at DESC, id DESC
        LIMIT 60`,
      [id]
    );
    points = [...points].reverse();
  }

  const change = priceChangeSummary(
    points.map((p) => ({ pricePaise: p.pricePaise, recordedAt: p.recordedAt }))
  );

  return c.json({
    ok: true,
    data: {
      productId: id,
      days,
      points: points.map((p) => ({
        pricePaise: p.pricePaise,
        mrpPaise: p.mrpPaise,
        recordedAt: p.recordedAt,
        source: p.source,
      })),
      change,
    },
  });
});

productRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const product = await queryOne<RowDataPacket>(
    `SELECT p.id, p.title, p.description, p.pack_size AS packSize,
            p.price_paise AS pricePaise, p.mrp_paise AS mrpPaise,
            p.in_stock AS inStock, p.stock_units AS stockUnits,
            c.id AS categoryId, c.name AS category,
            sc.id AS subcategoryId, sc.name AS subcategory,
            s.id AS shopId, s.name AS shopName, s.city AS shopCity,
            s.rating_avg AS shopRating, s.is_verified AS shopVerified, s.slug AS shopSlug
       FROM products p
       JOIN categories c ON c.id = p.category_id
  LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
       JOIN shops s ON s.id = p.shop_id
      WHERE p.id = ? AND p.status = 'live'`,
    [id]
  );
  if (!product) return c.json({ ok: false, error: "Product not found" }, 404);

  const [photos, phones, emails, history] = await Promise.all([
    query(`SELECT url, is_cover AS isCover, position FROM product_photos WHERE product_id = ? ORDER BY is_cover DESC, position`, [id]),
    query(`SELECT value, label FROM shop_contacts WHERE shop_id = ? AND kind = 'phone'`, [product.shopId]),
    query(`SELECT value, label FROM shop_contacts WHERE shop_id = ? AND kind = 'email'`, [product.shopId]),
    query<RowDataPacket & { pricePaise: number | null; recordedAt: Date }>(
      `SELECT price_paise AS pricePaise, recorded_at AS recordedAt
         FROM product_price_history WHERE product_id = ?
         ORDER BY recorded_at ASC, id ASC`,
      [id]
    ),
  ]);

  const change = priceChangeSummary(
    history.map((h) => ({ pricePaise: h.pricePaise, recordedAt: h.recordedAt }))
  );

  return c.json({
    ok: true,
    data: {
      ...product,
      photos,
      sellerPhones: phones,
      sellerEmails: emails,
      priceChange: change,
    },
  });
});

/* ============================================================
 * 4.10 "Add one" — list a single product
 * POST /api/products
 * ==========================================================*/
const productSchema = z.object({
  categoryId: z.number().int().positive(),
  subcategoryId: z.number().int().positive().optional(),
  title: z.string().min(2).max(200),
  description: z.string().max(3000).optional(),
  packSize: z.string().max(50).optional(),
  priceRupees: z.number().nonnegative().optional(),  // omit => shows N/A
  mrpRupees: z.number().nonnegative().optional(),
  inStock: z.boolean().default(true),
  stockUnits: z.number().int().nonnegative().optional(),
  photoUrls: z.array(z.string().url()).max(env.MAX_PRODUCT_PHOTOS).optional(), // first is cover
});

productRoutes.post("/", requireAuth, requireShop, async (c) => {
  const body = productSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    return c.json({ ok: false, error: "Invalid product details", details: body.error.flatten() }, 400);
  }
  const d = body.data;
  const shopId = c.get("user").shopId!;

  const productId = await withTransaction(async (conn) => {
    const [res] = await conn.execute(
      `INSERT INTO products (shop_id, category_id, subcategory_id, title, description,
                             pack_size, price_paise, mrp_paise, in_stock, stock_units)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [shopId, d.categoryId, d.subcategoryId ?? null, d.title, d.description ?? null,
       d.packSize ?? null,
       d.priceRupees !== undefined ? toPaise(d.priceRupees) : null,
       d.mrpRupees !== undefined ? toPaise(d.mrpRupees) : null,
       d.inStock ? 1 : 0, d.stockUnits ?? null]
    );
    const id = (res as { insertId: number }).insertId;
    if (d.photoUrls) {
      for (let i = 0; i < d.photoUrls.length; i++) {
        await conn.execute(
          `INSERT INTO product_photos (product_id, url, is_cover, position) VALUES (?, ?, ?, ?)`,
          [id, d.photoUrls[i]!, i === 0 ? 1 : 0, i]
        );
      }
    }
    await recordProductPrice(
      id,
      d.priceRupees !== undefined ? toPaise(d.priceRupees) : null,
      {
        mrpPaise: d.mrpRupees !== undefined ? toPaise(d.mrpRupees) : null,
        source: "create",
        conn,
      }
    );
    return id;
  });

  return c.json({ ok: true, data: { productId, message: "Your product is now live" } }, 201);
});

/* Seller: set or nudge price (always recorded in history) */
const priceAdjustSchema = z.object({
  priceRupees: z.number().nonnegative().nullable().optional(),
  adjustRupees: z.number().optional(),
  mrpRupees: z.number().nonnegative().nullable().optional(),
}).refine((v) => v.priceRupees !== undefined || v.adjustRupees !== undefined, {
  message: "Provide priceRupees or adjustRupees",
});

productRoutes.patch("/:id/price", requireAuth, requireShop, async (c) => {
  const body = priceAdjustSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    return c.json({ ok: false, error: "Invalid price update", details: body.error.flatten() }, 400);
  }
  const id = Number(c.req.param("id"));
  const shopId = c.get("user").shopId!;
  const row = await queryOne<RowDataPacket & { price_paise: number | null; mrp_paise: number | null }>(
    `SELECT id, price_paise, mrp_paise FROM products WHERE id = ? AND shop_id = ? AND status = 'live'`,
    [id, shopId]
  );
  if (!row) return c.json({ ok: false, error: "Product not found in your shop" }, 404);

  let nextPaise: number | null = row.price_paise;
  if (body.data.priceRupees !== undefined) {
    nextPaise = body.data.priceRupees == null ? null : toPaise(body.data.priceRupees);
  } else if (body.data.adjustRupees !== undefined) {
    const base = row.price_paise ?? 0;
    nextPaise = Math.max(0, base + toPaise(body.data.adjustRupees));
  }
  const nextMrp =
    body.data.mrpRupees !== undefined
      ? body.data.mrpRupees == null
        ? null
        : toPaise(body.data.mrpRupees)
      : row.mrp_paise;

  await execute(`UPDATE products SET price_paise = ?, mrp_paise = ? WHERE id = ?`, [
    nextPaise,
    nextMrp,
    id,
  ]);
  await recordProductPrice(id, nextPaise, { mrpPaise: nextMrp, source: "adjust" });

  return c.json({
    ok: true,
    data: {
      productId: id,
      pricePaise: nextPaise,
      mrpPaise: nextMrp,
      message: "Price updated",
    },
  });
});

/* Edit / stock toggle */
productRoutes.put("/:id", requireAuth, requireShop, async (c) => {
  const body = productSchema.partial().safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ ok: false, error: "Invalid product details" }, 400);
  const d = body.data;
  const id = Number(c.req.param("id"));
  const shopId = c.get("user").shopId!;

  const owned = await queryOne<RowDataPacket & { price_paise: number | null; mrp_paise: number | null }>(
    `SELECT id, price_paise, mrp_paise FROM products WHERE id = ? AND shop_id = ?`,
    [id, shopId]
  );
  if (!owned) return c.json({ ok: false, error: "Product not found in your shop" }, 404);

  const sets: string[] = [];
  const params: unknown[] = [];
  if (d.categoryId !== undefined)    { sets.push(`category_id = ?`);    params.push(d.categoryId); }
  if (d.subcategoryId !== undefined) { sets.push(`subcategory_id = ?`); params.push(d.subcategoryId); }
  if (d.title !== undefined)         { sets.push(`title = ?`);          params.push(d.title); }
  if (d.description !== undefined)   { sets.push(`description = ?`);    params.push(d.description); }
  if (d.packSize !== undefined)      { sets.push(`pack_size = ?`);      params.push(d.packSize); }
  if (d.priceRupees !== undefined)   { sets.push(`price_paise = ?`);    params.push(toPaise(d.priceRupees)); }
  if (d.mrpRupees !== undefined)     { sets.push(`mrp_paise = ?`);      params.push(toPaise(d.mrpRupees)); }
  if (d.inStock !== undefined)       { sets.push(`in_stock = ?`);       params.push(d.inStock ? 1 : 0); }
  if (d.stockUnits !== undefined)    { sets.push(`stock_units = ?`);    params.push(d.stockUnits); }
  if (sets.length) {
    await execute(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
  }
  if (d.photoUrls) {
    await execute(`DELETE FROM product_photos WHERE product_id = ?`, [id]);
    for (let i = 0; i < d.photoUrls.length; i++) {
      await execute(
        `INSERT INTO product_photos (product_id, url, is_cover, position) VALUES (?, ?, ?, ?)`,
        [id, d.photoUrls[i]!, i === 0 ? 1 : 0, i]
      );
    }
  }
  if (d.priceRupees !== undefined || d.mrpRupees !== undefined) {
    const pricePaise =
      d.priceRupees !== undefined ? toPaise(d.priceRupees) : owned.price_paise;
    const mrpPaise =
      d.mrpRupees !== undefined ? toPaise(d.mrpRupees) : owned.mrp_paise;
    await recordProductPrice(id, pricePaise, { mrpPaise, source: "edit" });
  }
  return c.json({ ok: true, data: { message: "Product updated" } });
});

productRoutes.delete("/:id", requireAuth, requireShop, async (c) => {
  const res = await execute(
    `UPDATE products SET status = 'removed' WHERE id = ? AND shop_id = ?`,
    [Number(c.req.param("id")), c.get("user").shopId!]
  );
  if (res.affectedRows === 0) return c.json({ ok: false, error: "Product not found in your shop" }, 404);
  return c.json({ ok: true, data: { message: "Product removed" } });
});

/* ============================================================
 * 4.10 "Bulk upload" — Excel/CSV up to 10 MB (Bulk upload helper)
 * POST /api/products/bulk   multipart: file
 * GET  /api/products/bulk/template — the downloadable template
 * ==========================================================*/
const TEMPLATE_COLUMNS = ["category", "subcategory", "title", "description", "pack_size", "price_rupees", "mrp_rupees", "in_stock", "stock_units"];

productRoutes.get("/bulk/template", (c) => {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_COLUMNS,
    ["Rajma", "Chitra", "Chitra Pila Badshah", "Premium quality, direct godown", "30 kg", 12600, 13000, "yes", 40],
  ]);
  // Demo price-list layout matching godown sheets (ITEMS / TRADEMARK / WEIGHT / PRICE)
  const priceList = XLSX.utils.aoa_to_sheet([
    ["ITEMS", "TRADEMARK", "WEIGHT", "PRICE"],
    ["Rajma", "Chitra Pila Badshah", "30KG", 12600],
    ["Rajma", "Chitra Sky Badshah", "30KG", 12500],
    ["Kabli", "Garbanzo Premium", "45KG", 9300],
    ["Moong", "Dhowa Orange 2X", "30KG", "N/A"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  XLSX.utils.book_append_sheet(wb, priceList, "PriceList");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return c.body(new Uint8Array(buf), 200, {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="harvesthub-bulk-template.xlsx"`,
  });
});

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  const map = new Map(Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]));
  for (const k of keys) {
    const v = map.get(k.toLowerCase());
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function inferSubcategory(title: string, catName: string): string | null {
  const t = title.toLowerCase();
  const hints: Record<string, string[]> = {
    rajma: ["chitra", "lal"],
    kabli: ["garbanzo", "balay"],
    chana: ["whole", "dal", "besan"],
    matar: ["safed", "hari", "besan"],
    urad: ["whole", "dhuli", "dhowa", "chilka"],
    moong: ["whole", "dhuli", "dhowa", "chilka"],
    masoor: ["whole", "malka", "dal"],
    lobiya: ["safed", "lal"],
  };
  for (const h of hints[catName.toLowerCase()] ?? []) {
    if (t.includes(h)) {
      if (h === "dhowa") return "Dhuli";
      if (h === "lal" && catName.toLowerCase() === "rajma") return "Rajma Lal";
      if (h === "lal") return "Lal";
      if (h === "balay") return "Balay Balay";
      return h.charAt(0).toUpperCase() + h.slice(1);
    }
  }
  return null;
}

productRoutes.post("/bulk", requireAuth, requireShop, async (c) => {
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return c.json({ ok: false, error: "Upload an Excel or CSV file in the 'file' field" }, 400);
  if (file.size > env.MAX_BULK_FILE_MB * 1024 * 1024) {
    return c.json({ ok: false, error: `File too large — maximum ${env.MAX_BULK_FILE_MB} MB` }, 413);
  }

  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  // Prefer PriceList sheet when present (godown rate sheet)
  const sheetName =
    wb.SheetNames.find((n) => /pricelist|price.?list|rate/i.test(n)) ?? wb.SheetNames[0];
  if (!sheetName) return c.json({ ok: false, error: "The file has no sheets" }, 400);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]!, { defval: "" });
  if (rows.length === 0) return c.json({ ok: false, error: "No rows found — download the template first" }, 400);

  const shopId = c.get("user").shopId!;
  const cats = await query<RowDataPacket & { id: number; name: string }>(`SELECT id, name FROM categories`);
  const subs = await query<RowDataPacket & { id: number; name: string; category_id: number }>(
    `SELECT id, name, category_id FROM subcategories`
  );
  const catByName = new Map(cats.map((x) => [x.name.toLowerCase(), x.id]));
  const subKey = (catId: number, name: string) => `${catId}:${name.toLowerCase()}`;
  const subByKey = new Map(subs.map((x) => [subKey(x.category_id, x.name), x.id]));

  async function ensureCategory(name: string): Promise<number> {
    const key = name.toLowerCase();
    const hit = catByName.get(key);
    if (hit) return hit;
    const maxSort = await queryOne<RowDataPacket & { m: number | null }>(
      `SELECT MAX(sort_order) AS m FROM categories`
    );
    const res = await execute(
      `INSERT INTO categories (name, sort_order) VALUES (?, ?)`,
      [name, (maxSort?.m ?? 0) + 1]
    );
    const id = Number(res.insertId);
    catByName.set(key, id);
    return id;
  }

  async function ensureSubcategory(categoryId: number, name: string): Promise<number> {
    const key = subKey(categoryId, name);
    const hit = subByKey.get(key);
    if (hit) return hit;
    const res = await execute(
      `INSERT INTO subcategories (category_id, name) VALUES (?, ?)`,
      [categoryId, name]
    );
    const id = Number(res.insertId);
    subByKey.set(key, id);
    return id;
  }

  let ok = 0;
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const rowNo = i + 2; // header is row 1
    try {
      const catName = cell(r, "category", "items", "item");
      if (!catName) throw new Error("Missing category");
      const catId = await ensureCategory(catName);

      const title = cell(r, "title", "trademark", "product", "name");
      if (title.length < 2) throw new Error("Missing product title");

      let subName = cell(r, "subcategory", "sub", "type");
      if (!subName) subName = inferSubcategory(title, catName) ?? "";
      const subId = subName ? await ensureSubcategory(catId, subName) : null;

      const priceRaw = cell(r, "price_rupees", "price", "rate");
      const price =
        !priceRaw || /^n\/?a$/i.test(priceRaw) ? null : Number(String(priceRaw).replace(/,/g, ""));
      if (price !== null && (!Number.isFinite(price) || price < 0)) throw new Error("Bad price");

      const mrpRaw = cell(r, "mrp_rupees", "mrp");
      const mrp = !mrpRaw ? null : Number(String(mrpRaw).replace(/,/g, ""));

      const pack = cell(r, "pack_size", "weight", "pack") || null;
      const inStock = /^(yes|y|true|1)?$/i.test(cell(r, "in_stock") || "yes");
      const stockRaw = cell(r, "stock_units", "stock");
      const stock = !stockRaw ? null : Number(stockRaw);

      const res = await execute(
        `INSERT INTO products (shop_id, category_id, subcategory_id, title, description,
                               pack_size, price_paise, mrp_paise, in_stock, stock_units)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [shopId, catId, subId, title,
         cell(r, "description") || null,
         pack,
         price !== null ? toPaise(price) : null,
         mrp !== null && Number.isFinite(mrp) ? toPaise(mrp) : null,
         inStock ? 1 : 0, stock]
      );
      await recordProductPrice(Number(res.insertId), price !== null ? toPaise(price) : null, {
        mrpPaise: mrp !== null && Number.isFinite(mrp) ? toPaise(mrp) : null,
        source: "bulk",
      });
      ok++;
    } catch (e) {
      errors.push({ row: rowNo, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  await execute(
    `INSERT INTO bulk_uploads (shop_id, filename, total_rows, ok_rows, failed_rows, errors_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [shopId, file.name, rows.length, ok, errors.length, errors.length ? JSON.stringify(errors) : null]
  );

  return c.json({ ok: true, data: { totalRows: rows.length, listed: ok, failed: errors.length, errors } });
});
